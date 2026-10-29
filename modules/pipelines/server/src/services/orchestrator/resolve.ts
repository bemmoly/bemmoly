import { ValidationError } from '@bemmoly/shared';
import type {
  BuildSpec,
  DeploySpec,
  PipelineDefinition,
  PipelineStepSpec,
  PipelineTemplate,
  ResolvedJob,
  ResolvedPipeline,
  ResolvedStep,
  Scalar,
  ScheduleSpec,
  TemplateRef,
} from '../../../../shared/pipeline-spec.ts';
import { resolveInputValues, type InputDeclarations } from './inputs.ts';
import { interpolate, interpolateRecord } from './interpolate.ts';
import { cellKey, cellName, expandMatrix, type MatrixCell } from './matrix.ts';

/*
 * Template plus overrides → the pipeline exactly as it will run (architecture §7). Runs
 * per commit; the result is stored on the run. An application's test steps come after the
 * template's; one with the key of a template step replaces it unless the template locked it.
 * Matrices expand here, so the stored pipeline lists every job; shards expand when the run's
 * jobs are created, because "auto" depends on timings at that moment.
 */

export type TemplateLookup = (ref: TemplateRef) => Promise<PipelineTemplate | null>;

export interface ResolveOptions {
  application: string | null;
  defaultTimeoutMinutes: number;
  /** Where the build pushes its image; null keeps it on the runner's machine. */
  registry?: string | null;
  /** A manual run's or a schedule's values; checked against the declared inputs. */
  inputs?: Readonly<Record<string, Scalar>>;
}

type Origin = ResolvedStep['origin'];
type SourcedStep = PipelineStepSpec & { origin: Origin };

interface Layers {
  template: TemplateRef | null;
  declared: InputDeclarations;
  passed: Record<string, Scalar>;
  checkout: boolean;
  build: BuildSpec | undefined;
  test: SourcedStep[];
  deploy: DeploySpec | null;
  schedules: ScheduleSpec[];
}

export function slugOf(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'step';
}

function mergeTests(template: PipelineStepSpec[], own: PipelineStepSpec[]): SourcedStep[] {
  const merged: SourcedStep[] = template.map((step) => ({ ...step, origin: 'template' }));
  for (const step of own) {
    const key = step.key ?? slugOf(step.name);
    const index = merged.findIndex((existing) => (existing.key ?? slugOf(existing.name)) === key);
    if (index === -1) {
      merged.push({ ...step, locked: false, origin: 'application' });
      continue;
    }
    if (merged[index]?.locked) {
      throw new ValidationError(`"${step.name}" is locked by the template and cannot be changed`);
    }
    merged[index] = { ...step, locked: false, origin: 'application' };
  }
  return merged;
}

async function layersOf(definition: PipelineDefinition, lookup: TemplateLookup): Promise<Layers> {
  if (!('extends' in definition)) {
    return {
      template: null,
      declared: definition.inputs,
      passed: {},
      checkout: definition.checkout,
      build: definition.build,
      test: definition.test.map((step) => ({ ...step, locked: false, origin: 'application' })),
      deploy: definition.deploy ?? null,
      schedules: definition.schedules,
    };
  }
  const template = await lookup(definition.extends);
  const name = `${definition.extends.ref}@${definition.extends.version}`;
  if (!template) {
    throw new ValidationError(
      `Template ${name} is not available. Sync the template repository or use a version that exists.`,
    );
  }
  const deploy = template.deploy ? { ...template.deploy, ...definition.deploy } : null;
  return {
    template: definition.extends,
    declared: { ...template.inputs, ...definition.inputs },
    passed: definition.with,
    checkout: template.checkout,
    build: template.build,
    test: mergeTests(template.test, definition.test ?? []),
    deploy: deploy as DeploySpec | null,
    schedules: definition.schedules ?? template.schedules,
  };
}

function resolveStep(
  spec: SourcedStep,
  key: string,
  inputs: Record<string, Scalar>,
  cell: MatrixCell | null,
): ResolvedStep {
  return {
    key,
    name: interpolate(spec.name, inputs, cell),
    image: spec.image ? interpolate(spec.image, inputs, cell) : null,
    run: spec.run ? interpolate(spec.run, inputs, cell) : null,
    uses: spec.uses ?? null,
    env: interpolateRecord(spec.env, inputs, cell),
    secrets: spec.secrets,
    locked: spec.locked,
    origin: spec.origin,
    junit: spec.junit ?? null,
    artifacts: spec.artifacts,
  };
}

/** "us-central1-docker.pkg.dev/acme-ci/apps/checkout-api", or a local name. */
function imageName(application: string, registry: string | null): string {
  return registry
    ? `${registry.replace(/\/+$/, '')}/${application}`
    : `bemmoly-local/${application}`;
}

function buildJob(
  build: BuildSpec,
  application: string | null,
  timeout: number,
  registry: string | null,
): ResolvedJob {
  return {
    key: 'build',
    name: 'Build',
    kind: 'build',
    needs: [],
    steps: [
      {
        key: 'build',
        name: 'Build image',
        image: null,
        run: null,
        uses: 'bemmoly/build',
        env: {
          BEMMOLY_BUILD_DOCKERFILE: build.dockerfile,
          BEMMOLY_BUILD_CONTEXT: build.context,
          BEMMOLY_BUILD_PLATFORMS: build.platforms.join(','),
          // The image a passing build becomes a release of, pushed when there is a registry.
          ...(application ? { BEMMOLY_BUILD_IMAGE: imageName(application, registry) } : {}),
          ...(application && registry ? { BEMMOLY_BUILD_PUSH: 'true' } : {}),
        },
        secrets: [],
        locked: true,
        origin: 'template',
        junit: null,
        artifacts: [],
      },
    ],
    pool: build.pool ?? null,
    shards: null,
    timeoutMinutes: timeout,
    application,
    matrix: null,
  };
}

/** One job per test entry, or one per matrix cell; `needs` names entries, not cells. */
function testJobs(layers: Layers, inputs: Record<string, Scalar>, options: ResolveOptions) {
  const keyed = layers.test.map((spec) => ({ spec, key: spec.key ?? slugOf(spec.name) }));
  const seen = new Set<string>();
  const expansions = new Map<string, string[]>();
  const jobs: ResolvedJob[] = [];
  for (const { spec, key } of keyed) {
    if (seen.has(key) || key === 'build') {
      throw new ValidationError(`Two steps share the key "${key}"; give one a different key`);
    }
    seen.add(key);
    const cells: Array<MatrixCell | null> = spec.matrix ? expandMatrix(spec.matrix) : [null];
    const keys: string[] = [];
    for (const cell of cells) {
      const jobKey = cell ? `${key}-${cellKey(cell)}` : key;
      const step = resolveStep(spec, jobKey, inputs, cell);
      keys.push(jobKey);
      jobs.push({
        key: jobKey,
        name: cell ? `${step.name} (${cellName(cell)})` : step.name,
        kind: spec.uses ? 'scan' : 'test',
        needs: spec.needs,
        steps: [step],
        pool: spec.pool ?? null,
        shards: spec.shards ?? null,
        timeoutMinutes: spec.timeoutMinutes ?? options.defaultTimeoutMinutes,
        application: options.application,
        matrix: cell,
      });
    }
    expansions.set(key, keys);
  }
  const fallback = layers.build ? ['build'] : [];
  for (const job of jobs) {
    job.needs =
      job.needs.length === 0
        ? fallback
        : job.needs.flatMap((need) => {
            if (need === 'build' && layers.build) return ['build'];
            const expanded = expansions.get(need);
            if (!expanded)
              throw new ValidationError(`"${job.name}" needs "${need}", which is not a step`);
            return expanded;
          });
  }
  return jobs;
}

export async function resolvePipeline(
  definition: PipelineDefinition,
  lookup: TemplateLookup,
  options: ResolveOptions,
): Promise<ResolvedPipeline> {
  const layers = await layersOf(definition, lookup);
  const inputs = resolveInputValues(layers.declared, [layers.passed, options.inputs ?? {}]);
  const jobs = [
    ...(layers.build
      ? [
          buildJob(
            layers.build,
            options.application,
            options.defaultTimeoutMinutes,
            options.registry ?? null,
          ),
        ]
      : []),
    ...testJobs(layers, inputs, options),
  ];
  assertAcyclic(jobs);
  const deploy = layers.deploy
    ? {
        ...layers.deploy,
        ...(typeof layers.deploy.port === 'string'
          ? { port: interpolate(layers.deploy.port, inputs) }
          : {}),
      }
    : null;
  return {
    template: layers.template,
    inputs,
    checkout: layers.checkout,
    jobs,
    deploy,
    schedules: layers.schedules,
  };
}

/** Needs form a DAG; a cycle would leave every job in it pending forever. */
export function assertAcyclic(jobs: ReadonlyArray<Pick<ResolvedJob, 'key' | 'needs'>>): void {
  const needs = new Map(jobs.map((job) => [job.key, job.needs]));
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (key: string, path: string[]) => {
    if (state.get(key) === 'done') return;
    if (state.get(key) === 'visiting') {
      throw new ValidationError(
        `Steps wait on each other in a loop: ${[...path, key].join(' → ')}`,
      );
    }
    state.set(key, 'visiting');
    for (const need of needs.get(key) ?? []) visit(need, [...path, key]);
    state.set(key, 'done');
  };
  for (const job of jobs) visit(job.key, []);
}

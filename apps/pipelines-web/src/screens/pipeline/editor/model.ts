import {
  DEPLOY_ACTION,
  pipelineSpecSchema,
  type PipelineSpec,
  type PipelineStepSpec,
} from '@bemmoly/module-pipelines/shared';
import type { StageGraphGroup, StageGraphStage } from '@bemmoly/ui';

/*
 * The pipeline the editor draws and changes: a build, then steps, each optionally under an
 * environment. Laid out as the run view lays out a run, build first and then each environment
 * in path order, so what people edit is what they will see run.
 */

export interface EditorEnvironment {
  key: string;
  name: string;
  where: string | null;
}

export type StepKind = 'build' | 'deploy' | 'script' | 'uses';

export const BUILD_KEY = 'build';

/** A stored definition the editor can draw; null for one that extends a template file. */
export function editable(raw: unknown): PipelineSpec | null {
  if (typeof raw === 'object' && raw !== null && 'extends' in raw) return null;
  const parsed = pipelineSpecSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : null;
}

export const keyOf = (step: PipelineStepSpec) =>
  step.key ??
  (step.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') ||
    'step');

export function kindOf(step: PipelineStepSpec): StepKind {
  if (step.uses === DEPLOY_ACTION) return 'deploy';
  return step.uses ? 'uses' : 'script';
}

/** What a step waits for: what it names, else the build (as the server resolves it). */
export function needsOf(definition: PipelineSpec, step: PipelineStepSpec): string[] {
  if (step.needs.length > 0) return step.needs;
  return definition.build ? [BUILD_KEY] : [];
}

function depths(nodes: Array<{ key: string; needs: string[] }>): Map<string, number> {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const depth = new Map<string, number>();
  const visit = (key: string, seen: Set<string>): number => {
    const known = depth.get(key);
    if (known !== undefined) return known;
    const node = byKey.get(key);
    if (!node || seen.has(key)) return 0;
    seen.add(key);
    const value = node.needs.reduce(
      (deepest, need) => (byKey.has(need) ? Math.max(deepest, visit(need, seen) + 1) : deepest),
      0,
    );
    depth.set(key, value);
    return value;
  };
  for (const node of nodes) visit(node.key, new Set());
  return depth;
}

export interface Layout {
  stages: StageGraphStage[];
  groups: StageGraphGroup[];
  edges: Array<{ from: string; to: string }>;
}

export interface LayoutWords {
  build: string;
  buildWhere: string | null;
  kind: (kind: StepKind) => string;
}

export function layoutOf(
  definition: PipelineSpec,
  environments: readonly EditorEnvironment[],
  words: LayoutWords,
): Layout {
  const nodes = [
    ...(definition.build
      ? [
          {
            key: BUILD_KEY,
            name: words.build,
            needs: [] as string[],
            environment: null as string | null,
            kind: 'build' as StepKind,
          },
        ]
      : []),
    ...definition.test.map((step) => ({
      key: keyOf(step),
      name: step.name,
      needs: needsOf(definition, step),
      environment: step.environment ?? null,
      kind: kindOf(step),
    })),
  ];
  const known = environments.filter((environment) =>
    nodes.some((node) => node.environment === environment.key),
  );
  const strays = [...new Set(nodes.map((node) => node.environment))].filter(
    (key): key is string => key !== null && !environments.some((e) => e.key === key),
  );
  const buckets = [
    { id: '', label: words.build, detail: words.buildWhere, environment: null as string | null },
    ...known.map((e) => ({ id: e.key, label: e.name, detail: e.where, environment: e.key })),
    ...strays.map((key) => ({ id: key, label: key, detail: null, environment: key })),
  ];
  const stages: StageGraphStage[] = [];
  const groups: StageGraphGroup[] = [];
  let offset = 0;
  for (const bucket of buckets) {
    const own = nodes.filter((node) => node.environment === bucket.environment);
    if (own.length === 0) continue;
    const keys = new Set(own.map((node) => node.key));
    const depth = depths(
      own.map((node) => ({ key: node.key, needs: node.needs.filter((n) => keys.has(n)) })),
    );
    const deepest = Math.max(...own.map((node) => depth.get(node.key) ?? 0));
    for (let index = 0; index <= deepest; index += 1) {
      stages.push({
        index: offset + index,
        nodes: own
          .filter((node) => (depth.get(node.key) ?? 0) === index)
          .map((node) => ({
            id: node.key,
            name: node.name,
            state: 'queued',
            detail: words.kind(node.kind),
          })),
      });
    }
    groups.push({
      id: bucket.id || 'build',
      label: bucket.label,
      detail: bucket.detail,
      stages: Array.from({ length: deepest + 1 }, (_, index) => offset + index),
    });
    offset += deepest + 1;
  }
  const present = new Set(nodes.map((node) => node.key));
  const edges = nodes.flatMap((node) =>
    node.needs.filter((need) => present.has(need)).map((need) => ({ from: need, to: node.key })),
  );
  return { stages, groups, edges };
}

/** A key no other step has: "smoke-tests", "smoke-tests-2". */
export function freeKey(definition: PipelineSpec, base: string): string {
  const taken = new Set([BUILD_KEY, ...definition.test.map(keyOf)]);
  const clean = base.slice(0, 58) || 'step';
  if (!taken.has(clean)) return clean;
  let n = 2;
  while (taken.has(`${clean}-${n}`)) n += 1;
  return `${clean}-${n}`;
}

/** The last step in an environment's group, or before it, that a new step should wait for. */
function lastBefore(
  definition: PipelineSpec,
  environment: string | null,
  order: readonly string[],
) {
  const position = (env: string | null) => (env === null ? -1 : order.indexOf(env));
  const candidates = definition.test.filter(
    (step) => position(step.environment ?? null) <= position(environment),
  );
  const last = candidates.at(-1);
  if (last) return [keyOf(last)];
  return definition.build ? [BUILD_KEY] : [];
}

export type NewStep = 'build' | 'deploy' | 'script' | 'integration';

export function addStep(
  definition: PipelineSpec,
  kind: NewStep,
  name: string,
  environment: string | null,
  order: readonly string[],
): { definition: PipelineSpec; key: string } {
  if (kind === 'build') {
    return {
      definition: {
        ...definition,
        build: definition.build ?? {
          dockerfile: 'Dockerfile',
          context: '.',
          platforms: ['linux/amd64'],
          args: {},
        },
      },
      key: BUILD_KEY,
    };
  }
  const key = freeKey(
    definition,
    `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}${environment ? `-${environment}` : ''}`,
  );
  const base = {
    name,
    key,
    needs: lastBefore(definition, environment, order),
    locked: false,
    env: {},
    secrets: [],
    artifacts: [],
    ...(environment ? { environment } : {}),
  };
  const step: PipelineStepSpec =
    kind === 'deploy'
      ? { ...base, uses: DEPLOY_ACTION }
      : { ...base, image: 'alpine:3.20', run: `echo "${name}"` };
  return { definition: { ...definition, test: [...definition.test, step] }, key };
}

export function updateStep(
  definition: PipelineSpec,
  key: string,
  patch: Partial<PipelineStepSpec>,
): PipelineSpec {
  return {
    ...definition,
    test: definition.test.map((step) => (keyOf(step) === key ? { ...step, ...patch } : step)),
  };
}

export function removeStep(definition: PipelineSpec, key: string): PipelineSpec {
  if (key === BUILD_KEY) {
    const rest: PipelineSpec = { ...definition };
    delete rest.build;
    return {
      ...rest,
      test: definition.test.map((step) => ({
        ...step,
        needs: step.needs.filter((need) => need !== key),
      })),
    };
  }
  return {
    ...definition,
    test: definition.test
      .filter((step) => keyOf(step) !== key)
      .map((step) => ({ ...step, needs: step.needs.filter((need) => need !== key) })),
  };
}

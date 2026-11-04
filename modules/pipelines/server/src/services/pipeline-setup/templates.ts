import {
  DEPLOY_ACTION,
  type PipelineSpec,
  type PipelineStepSpec,
} from '../../../../shared/pipeline-spec.ts';
import type {
  BuiltInTemplateKey,
  BuiltInTemplateSummary,
} from '../../../../shared/pipeline-setup.ts';

/*
 * The four templates that ship with Bemmoly (product rule 8). They are starting points a
 * person picks, never applied on their own, and they are drawn from the environments that
 * exist: one group per environment on the path, in order, and nothing for an environment
 * the install does not have. An environment with an approval rule is reached by promoting
 * a version through a change request, so the Deliver pipeline stops before it.
 */

/** An environment as a template sees it: its ID, its name and whether it needs approval. */
export interface TemplateEnvironment {
  key: string;
  name: string;
  approvalRule: boolean;
}

export interface TemplateContext {
  environments: readonly TemplateEnvironment[];
  /** The service's folder in its repository; "" for the root. */
  path: string;
  /** The runner pool builds go to: Cloud Build in the first environment's project, if any. */
  buildPool: string | null;
}

interface Group {
  name: string;
  environment: string | null;
  steps: PipelineStepSpec[];
  /** Words for a group that has no job, such as "Promote when approved". */
  note?: string;
}

interface Template {
  key: BuiltInTemplateKey;
  name: string;
  description: string;
  suggested: boolean;
  suggestedTrigger: string;
  build: boolean;
  groups: (context: TemplateContext) => { groups: Group[]; leftOut: string[] };
}

/** A starting command that passes and says where to put the real one. */
const IMAGE = 'alpine:3.20';
const placeholder = (what: string) =>
  `echo "${what}: replace this with your command in the pipeline editor"`;

const keyOf = (text: string) => text.slice(0, 63).replace(/-+$/, '');

function script(name: string, needs: string[], environment?: string): PipelineStepSpec {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    name,
    key: keyOf(environment ? `${base}-${environment}` : base),
    image: IMAGE,
    run: placeholder(name),
    needs,
    locked: false,
    env: {},
    secrets: [],
    artifacts: [],
    ...(environment ? { environment } : {}),
  };
}

function deploy(environment: string, needs: string[], name = 'Deploy'): PipelineStepSpec {
  return {
    name,
    key: keyOf(`deploy-${environment}`),
    uses: DEPLOY_ACTION,
    needs,
    locked: false,
    env: {},
    secrets: [],
    artifacts: [],
    environment,
  };
}

const lastKey = (steps: readonly PipelineStepSpec[]) => steps.at(-1)?.key ?? 'build';

const TEMPLATES: readonly Template[] = [
  {
    key: 'dev-stage-production',
    name: 'Dev, then Stage, then Production',
    description:
      'Build once, deploy to each environment in order, test after each. An environment that needs approval is reached through a change request.',
    suggested: true,
    suggestedTrigger: 'On push to main',
    build: true,
    groups: ({ environments }) => {
      const unit = script('Unit tests', ['build']);
      const groups: Group[] = [{ name: 'Build', environment: null, steps: [unit] }];
      let after = unit.key ?? 'unit-tests';
      let gated = false;
      environments.forEach((environment, index) => {
        gated = gated || environment.approvalRule;
        if (gated) {
          groups.push({
            name: environment.name,
            environment: environment.key,
            steps: [],
            note: 'Promote when approved',
          });
          return;
        }
        const step = deploy(environment.key, [after]);
        const check = script(
          index === 0 ? 'Integration tests' : 'Smoke tests',
          [step.key ?? ''],
          environment.key,
        );
        after = check.key ?? after;
        groups.push({ name: environment.name, environment: environment.key, steps: [step, check] });
      });
      const named = ['Dev', 'Stage', 'Production'];
      const leftOut =
        environments.length === 0
          ? named
          : environments.length === 1
            ? named.slice(1)
            : environments.length === 2
              ? ['Stage']
              : [];
      return { groups, leftOut };
    },
  },
  {
    key: 'one-environment',
    name: 'One environment',
    description: 'Build, test and deploy to a single environment.',
    suggested: false,
    suggestedTrigger: 'On push to main',
    build: true,
    groups: ({ environments }) => {
      const unit = script('Unit tests', ['build']);
      const groups: Group[] = [{ name: 'Build', environment: null, steps: [unit] }];
      const first = environments[0];
      if (!first) return { groups, leftOut: ['Deploy'] };
      const step = deploy(first.key, [lastKey([unit])]);
      groups.push({
        name: first.name,
        environment: first.key,
        steps: [step, script('Smoke tests', [step.key ?? ''], first.key)],
      });
      return { groups, leftOut: [] };
    },
  },
  {
    key: 'cloud-run-job',
    name: 'Cloud Run job',
    description:
      'Build an image and deploy it as a job, for migrations, backfills and scheduled work.',
    suggested: false,
    suggestedTrigger: 'Manual or on a schedule',
    build: true,
    groups: ({ environments }) => {
      const groups: Group[] = [{ name: 'Build', environment: null, steps: [] }];
      const first = environments[0];
      if (!first) return { groups, leftOut: ['Run'] };
      groups.push({
        name: first.name,
        environment: first.key,
        steps: [deploy(first.key, ['build'], 'Deploy the job')],
      });
      return { groups, leftOut: [] };
    },
  },
  {
    key: 'pull-request-checks',
    name: 'Pull request checks',
    description: 'Build and test every pull request. Deploys nothing.',
    suggested: false,
    suggestedTrigger: 'On pull request',
    build: true,
    groups: () => ({
      groups: [
        {
          name: 'Check',
          environment: null,
          steps: [script('Unit tests', ['build']), script('Lint', ['build'])],
        },
      ],
      leftOut: [],
    }),
  },
];

const templateOf = (key: BuiltInTemplateKey): Template =>
  TEMPLATES.find((template) => template.key === key) ?? (TEMPLATES[0] as Template);

/** Every built-in template's preview for the environments that exist, suggested first. */
export function builtInTemplates(context: TemplateContext): BuiltInTemplateSummary[] {
  return TEMPLATES.map((template) => {
    const { groups, leftOut } = template.groups(context);
    return {
      key: template.key,
      name: template.name,
      description: template.description,
      suggested: template.suggested,
      groups: groups.map((group, index) => ({
        name: group.name,
        environment: group.environment,
        steps: [
          ...(index === 0 && template.build ? ['Build image'] : []),
          ...group.steps.map((step) => step.name),
          ...(group.note ? [group.note] : []),
        ],
      })),
      suggestedTrigger: template.suggestedTrigger,
      leftOut,
      definition: definitionFrom(template.key, context),
    };
  });
}

/** The pipeline a template makes for one service: a build, then each group's steps. */
export function definitionFrom(key: BuiltInTemplateKey, context: TemplateContext): PipelineSpec {
  const template = templateOf(key);
  const { groups } = template.groups(context);
  return {
    inputs: {},
    checkout: true,
    ...(template.build
      ? {
          build: {
            dockerfile: context.path ? `${context.path}/Dockerfile` : 'Dockerfile',
            context: context.path || '.',
            platforms: ['linux/amd64'],
            args: {},
            ...(context.buildPool ? { pool: context.buildPool } : {}),
          },
        }
      : {}),
    test: groups.flatMap((group) => group.steps),
    schedules: [],
  };
}

/** An empty pipeline: no build, no steps. Each step is the person's to add. */
export function emptyDefinition(): PipelineSpec {
  return { inputs: {}, checkout: true, test: [], schedules: [] };
}

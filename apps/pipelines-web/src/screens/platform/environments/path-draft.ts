import type {
  Environment,
  EnvironmentClass,
  EnvironmentPath,
  SetPathBody,
} from '@bemmoly/module-pipelines/shared';

/*
 * The path editor's rules: an ordered list of environments, each with a stage (environments
 * sharing one roll out together), how long a release bakes there and whether it moves on by
 * itself. A stage left as null is the step's place in the list, so a path typed in order
 * needs no numbers at all.
 */

export interface StepDraft {
  environmentId: string;
  name: string;
  class: EnvironmentClass;
  stage: number | null;
  bakeMinutes: number;
  autoPromote: boolean;
}

export const stageAt = (steps: readonly StepDraft[], index: number) => steps[index]?.stage ?? index;

/** Whether a step may move on by itself: never into production. */
export const canAutoPromote = (step: Pick<StepDraft, 'class'>) => step.class !== 'prod';

/** A path as the editor starts: the saved steps in stage order, or none for a new tier. */
export function draftOfPath(path: EnvironmentPath | undefined): StepDraft[] {
  return [...(path?.steps ?? [])]
    .sort((a, b) => a.stage - b.stage)
    .map((step) => ({
      environmentId: step.environment.id,
      name: step.environment.name,
      class: step.environment.class,
      stage: step.stage,
      bakeMinutes: step.bakeMinutes,
      autoPromote: step.autoPromote,
    }));
}

export function addStep(steps: readonly StepDraft[], environment: Environment): StepDraft[] {
  if (steps.some((step) => step.environmentId === environment.id)) return [...steps];
  return [
    ...steps,
    {
      environmentId: environment.id,
      name: environment.name,
      class: environment.class,
      stage: null,
      bakeMinutes: 0,
      autoPromote: false,
    },
  ];
}

/** Moving a step takes its stage along with its place, so order and stage keep agreeing. */
export function moveStep(steps: readonly StepDraft[], index: number, by: -1 | 1): StepDraft[] {
  const other = index + by;
  const here = steps[index];
  const there = steps[other];
  if (!here || !there) return [...steps];
  const next = [...steps];
  next[index] = { ...there, stage: stageAt(steps, index) };
  next[other] = { ...here, stage: stageAt(steps, other) };
  return next;
}

export function removeStep(steps: readonly StepDraft[], index: number): StepDraft[] {
  return steps.filter((_, at) => at !== index);
}

export function setStep(
  steps: readonly StepDraft[],
  index: number,
  patch: Partial<Pick<StepDraft, 'stage' | 'bakeMinutes' | 'autoPromote'>>,
): StepDraft[] {
  return steps.map((step, at) => (at === index ? { ...step, ...patch } : step));
}

/** Live environments not on the path yet, left to right. */
export function addable(
  environments: readonly Environment[],
  steps: readonly StepDraft[],
): Environment[] {
  const taken = new Set(steps.map((step) => step.environmentId));
  return environments
    .filter((environment) => !taken.has(environment.id))
    .sort((a, b) => a.position - b.position);
}

export function pathBodyOf(steps: readonly StepDraft[]): SetPathBody {
  return {
    steps: steps.map((step, index) => ({
      environmentId: step.environmentId,
      stage: stageAt(steps, index),
      bakeMinutes: step.bakeMinutes,
      // Production is only ever promoted to by a person; the server ignores it there too.
      autoPromote: step.class !== 'prod' && step.autoPromote,
    })),
  };
}

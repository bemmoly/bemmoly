import type { Environment, EnvironmentPath } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import { addStep, addable, draftOfPath, moveStep, pathBodyOf, removeStep } from './path-draft.ts';

const env = (id: string, position: number) =>
  ({ id, key: id, name: id, class: 'dev', position }) as Environment;

describe('the path editor', () => {
  it('gives each new step its place in the list as its stage', () => {
    const steps = addStep(addStep(addStep([], env('dev', 0)), env('staging', 1)), env('prod', 2));
    expect(pathBodyOf(steps).steps.map((step) => [step.environmentId, step.stage])).toEqual([
      ['dev', 0],
      ['staging', 1],
      ['prod', 2],
    ]);
    expect(addStep(steps, env('dev', 0))).toHaveLength(3);
  });

  it('starts from the saved path in stage order, keeping shared stages', () => {
    const path = {
      id: 'p',
      tier: 0,
      name: 'Tier 0',
      steps: [
        {
          environment: { id: 'eu', key: 'eu', name: 'EU', class: 'prod' },
          stage: 3,
          bakeMinutes: 30,
          autoPromote: false,
        },
        {
          environment: { id: 'dev', key: 'dev', name: 'Dev', class: 'dev' },
          stage: 0,
          bakeMinutes: 0,
          autoPromote: true,
        },
        {
          environment: { id: 'us', key: 'us', name: 'US', class: 'prod' },
          stage: 3,
          bakeMinutes: 30,
          autoPromote: false,
        },
      ],
    } as EnvironmentPath;
    const body = pathBodyOf(draftOfPath(path));
    expect(body.steps.map((step) => [step.environmentId, step.stage])).toEqual([
      ['dev', 0],
      ['eu', 3],
      ['us', 3],
    ]);
    expect(body.steps[1]).toMatchObject({ bakeMinutes: 30, autoPromote: false });
  });

  it('moves a step with its stage, so order and stages agree', () => {
    const steps = addStep(addStep([], env('dev', 0)), env('prod', 1));
    const moved = moveStep(steps, 1, -1);
    expect(pathBodyOf(moved).steps.map((step) => [step.environmentId, step.stage])).toEqual([
      ['prod', 0],
      ['dev', 1],
    ]);
    expect(moveStep(steps, 0, -1)).toEqual(steps);
  });

  it('offers only live environments not on the path yet, left to right', () => {
    const steps = addStep([], env('dev', 0));
    const offered = addable([env('prod', 2), env('dev', 0), env('staging', 1)], steps);
    expect(offered.map((environment) => environment.id)).toEqual(['staging', 'prod']);
    expect(removeStep(steps, 0)).toEqual([]);
  });
});

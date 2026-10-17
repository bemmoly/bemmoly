import type { EnvironmentPath } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import { stagesOf } from './paths.tsx';

const step = (key: string, stage: number) => ({
  environment: { id: key, key, name: key, class: 'prod' as const },
  stage,
  bakeMinutes: 0,
  autoPromote: false,
});

describe('stagesOf', () => {
  it('groups environments that share a stage, in stage order', () => {
    const path = {
      id: 'p',
      tier: 0,
      name: 'Tier 0',
      steps: [step('us', 3), step('dev', 0), step('eu', 3), step('asia', 2)],
    } as EnvironmentPath;
    expect(stagesOf(path).map((stage) => stage.map((s) => s.environment.key))).toEqual([
      ['dev'],
      ['asia'],
      ['us', 'eu'],
    ]);
  });
});

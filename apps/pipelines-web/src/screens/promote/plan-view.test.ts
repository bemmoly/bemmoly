import type { Deployment, RolloutWave } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import { stepsOf } from './plan-view.ts';

const WAVE = {
  wave: 1,
  environments: [],
  steps: [5, 25, 100].map((trafficPercent) => ({ trafficPercent, holdMinutes: 10 })),
  startsAfter: null,
  checks: ['error_rate'],
} as unknown as RolloutWave;

const at = (state: Deployment['state'], trafficPercent: number, phase = 'step') =>
  ({ state, trafficPercent, phase }) as Deployment;

describe('stepsOf', () => {
  it('is the plan alone before anything deploys', () => {
    expect(stepsOf(WAVE, undefined).map((step) => [step.label, step.state])).toEqual([
      ['5%', undefined],
      ['25%', undefined],
      ['100%', undefined],
    ]);
  });

  it('marks the live step running, those before passed and those after queued', () => {
    expect(stepsOf(WAVE, at('canary', 25)).map((step) => step.state)).toEqual([
      'passed',
      'running',
      'queued',
    ]);
    expect(stepsOf(WAVE, at('canary', 25, 'paused')).map((step) => step.state)).toEqual([
      'passed',
      'waiting',
      'queued',
    ]);
  });

  it('shows a roll back where it happened and skips what never ran', () => {
    expect(stepsOf(WAVE, at('rolled_back', 25)).map((step) => step.state)).toEqual([
      'rolled_back',
      'rolled_back',
      'skipped',
    ]);
    expect(stepsOf(WAVE, at('succeeded', 100)).every((step) => step.state === 'passed')).toBe(true);
  });
});

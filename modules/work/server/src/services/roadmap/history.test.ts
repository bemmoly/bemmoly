import { describe, expect, it } from 'vitest';
import { projectHistory, steadiness, type ProjectRecord } from './history.ts';

const record = (overrides: Partial<ProjectRecord> = {}): ProjectRecord => ({
  id: 'plt',
  name: 'Platform Core',
  method: 'scrum',
  velocity: [20, 22, 18],
  sprintDays: 14,
  throughput: [4, 4, 4, 4, 4, 4, 4, 4],
  openIssues: 10,
  estimatedIssues: 9,
  meanEstimate: 3,
  ...overrides,
});

describe('projectHistory', () => {
  it('forecasts in points from three sprints when the work is estimated', () => {
    expect(projectHistory(record()).history).toEqual({
      basis: 'velocity',
      unit: 'points',
      samples: [20, 22, 18],
      periodDays: 14,
    });
  });

  it('falls back to weekly issues with too few sprints or too few estimates', () => {
    for (const changed of [
      { velocity: [20, 22] },
      { estimatedIssues: 5 },
      { method: 'kanban' as const },
      { sprintDays: null },
      { velocity: [0, 0, 0] },
    ]) {
      expect(projectHistory(record(changed)).history).toMatchObject({
        basis: 'throughput',
        unit: 'issues',
        periodDays: 7,
      });
    }
  });

  it('offers nothing below three finished issues, and says how many there were', () => {
    const quiet = projectHistory(
      record({ method: 'kanban', throughput: [0, 0, 1, 0, 0, 1, 0, 0] }),
    );
    expect(quiet).toMatchObject({ history: null, completions: 2 });
  });

  it('counts an unestimated issue at one point when nothing is estimated', () => {
    expect(projectHistory(record({ meanEstimate: null })).meanEstimate).toBe(1);
  });
});

describe('steadiness', () => {
  it('trusts a long, steady pace', () => {
    expect(steadiness([4, 4, 5, 4, 3, 4, 4, 5])).toEqual({ confidence: 'high', reason: 'steady' });
  });

  it('is less sure of a pace that swings', () => {
    expect(steadiness([3, 7, 2, 5, 6, 4, 0, 5])).toEqual({
      confidence: 'medium',
      reason: 'swings',
    });
    expect(steadiness([1, 9, 0, 8, 0, 1, 0, 0])).toEqual({ confidence: 'low', reason: 'swings' });
  });

  it('is unsure of a short history', () => {
    expect(steadiness([0, 0, 0, 0, 0, 0, 2, 3])).toEqual({ confidence: 'low', reason: 'short' });
    expect(steadiness([20, 22, 18])).toEqual({ confidence: 'medium', reason: 'short' });
  });
});

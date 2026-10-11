import type { ForecastItem, ForecastProject } from './forecast.ts';
import { toDay } from './days.ts';

/*
 * Fixture histories for the forecast tests: teams whose past is written down, so every date
 * the forecast gives can be worked out by hand (the steady team) or is pinned once and must
 * never drift (the uneven team). Today is Monday 5 October 2026 throughout.
 */

export const TODAY = toDay('2026-10-05');

/** Four issues every week for eight weeks: every future is the same future. */
export const STEADY: ForecastProject = {
  name: 'Platform Core',
  history: {
    basis: 'throughput',
    unit: 'issues',
    samples: [4, 4, 4, 4, 4, 4, 4, 4],
    periodDays: 7,
  },
  meanEstimate: 3,
  completions: 32,
};

/** A real-looking team: a quiet week, a burst, a holiday. */
export const UNEVEN: ForecastProject = {
  name: 'Support',
  history: {
    basis: 'throughput',
    unit: 'issues',
    samples: [3, 7, 2, 5, 6, 4, 0, 5],
    periodDays: 7,
  },
  meanEstimate: 2,
  completions: 32,
};

/** Five two-week sprints of points, steady to within a few points. */
export const SPRINTING: ForecastProject = {
  name: 'Billing',
  history: { basis: 'velocity', unit: 'points', samples: [20, 22, 18, 20, 20], periodDays: 14 },
  meanEstimate: 4,
  completions: 30,
};

/** One issue finished in eight weeks: too little to forecast from. */
export const QUIET: ForecastProject = {
  name: 'Research',
  history: null,
  meanEstimate: 1,
  completions: 1,
};

export const epic = (
  overrides: Partial<ForecastItem> & Pick<ForecastItem, 'id'>,
): ForecastItem => ({
  kind: 'epic',
  projectId: 'plt',
  title: overrides.id,
  done: false,
  totalIssues: 12,
  remainingIssues: 12,
  remainingPoints: 0,
  unestimated: 0,
  started: true,
  startDay: null,
  targetDay: null,
  sharedWith: 0,
  ...overrides,
});

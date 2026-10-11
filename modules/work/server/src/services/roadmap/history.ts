import type { ForecastConfidence, ForecastHistory } from '../../../../shared/roadmap.ts';

/*
 * Which history a project's forecasts replay. A project that runs sprints and estimates its
 * work forecasts in points from its sprint velocity; any other forecasts in issues from its
 * weekly throughput. Both series are the Board's own metrics (sprint_metrics), so the roadmap
 * and the board never disagree about how fast a team goes.
 */

/** Closed sprints velocity needs before it is trusted. */
export const MIN_SPRINTS = 3;
/** Issues finished in the throughput window before a forecast is offered. */
export const MIN_COMPLETIONS = 3;
/** Open issues that must carry an estimate for points to be the measure. */
export const ESTIMATED_SHARE = 0.7;

export interface ProjectRecord {
  id: string;
  name: string;
  method: 'scrum' | 'kanban';
  /** Completed points per closed sprint, oldest first. */
  velocity: readonly number[];
  /** Mean length of those sprints in days; null without any. */
  sprintDays: number | null;
  /** Issues finished per week, oldest first. */
  throughput: readonly number[];
  /** Open, non-epic issues in the project, and how many carry an estimate. */
  openIssues: number;
  estimatedIssues: number;
  /** Mean estimate of the open issues that have one. */
  meanEstimate: number | null;
}

export interface ProjectHistory {
  history: ForecastHistory | null;
  /** What an unestimated issue counts as under velocity. */
  meanEstimate: number;
  /** Issues finished in the throughput window: the words for "not enough history" use it. */
  completions: number;
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

export function projectHistory(record: ProjectRecord): ProjectHistory {
  const completions = sum(record.throughput);
  const meanEstimate = record.meanEstimate ?? 1;
  const estimated =
    record.openIssues === 0 ? 1 : record.estimatedIssues / Math.max(1, record.openIssues);
  if (
    record.method === 'scrum' &&
    record.velocity.length >= MIN_SPRINTS &&
    record.sprintDays !== null &&
    record.sprintDays > 0 &&
    sum(record.velocity) > 0 &&
    estimated >= ESTIMATED_SHARE
  ) {
    return {
      history: {
        basis: 'velocity',
        unit: 'points',
        samples: [...record.velocity],
        periodDays: record.sprintDays,
      },
      meanEstimate,
      completions,
    };
  }
  if (completions >= MIN_COMPLETIONS) {
    return {
      history: {
        basis: 'throughput',
        unit: 'issues',
        samples: [...record.throughput],
        periodDays: 7,
      },
      meanEstimate,
      completions,
    };
  }
  return { history: null, meanEstimate, completions };
}

export interface Steadiness {
  confidence: ForecastConfidence;
  /** Why, for the explanation: few periods with finished work, or a pace that swings. */
  reason: 'steady' | 'swings' | 'short';
}

/**
 * How far to trust a forecast from these samples: steady and long is high, a pace that
 * swings by more than about a third of its mean or a short history lowers it.
 */
export function steadiness(samples: readonly number[]): Steadiness {
  const working = samples.filter((sample) => sample > 0).length;
  const mean = samples.length === 0 ? 0 : sum(samples) / samples.length;
  const variance =
    samples.length === 0
      ? 0
      : samples.reduce((total, sample) => total + (sample - mean) ** 2, 0) / samples.length;
  const spread = mean > 0 ? Math.sqrt(variance) / mean : Number.POSITIVE_INFINITY;
  if (working < 3) return { confidence: 'low', reason: 'short' };
  if (spread > 0.7) return { confidence: 'low', reason: 'swings' };
  if (working >= 6 && spread <= 0.35) return { confidence: 'high', reason: 'steady' };
  return { confidence: 'medium', reason: spread > 0.35 ? 'swings' : 'short' };
}

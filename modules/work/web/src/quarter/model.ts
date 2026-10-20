import {
  quarterOf,
  shiftQuarter,
  type QuarterRef,
  type QuarterReport,
} from '@bemmoly/module-work/shared';
import { useQuery } from '@tanstack/react-query';
import { api, workKeys } from '../shared/index.ts';

/* The quarter view's read and the figures its parts draw. */

export function useQuarterReport(projectKey: string, quarter: QuarterRef | undefined) {
  const ref = quarter ?? quarterOf(Date.now());
  return useQuery({
    queryKey: workKeys.quarterReport(projectKey, ref),
    queryFn: ({ signal }) => api.work.quarter(projectKey, { quarter: ref }, { signal }),
    enabled: Boolean(projectKey),
  });
}

/** "2026-Q4" → "Q4 2026". */
export const quarterLabel = (ref: QuarterRef) => {
  const [year, q] = ref.split('-');
  return `${q} ${year}`;
};

/** The quarters the picker offers: a year back, this one and the next. */
export const quarterChoices = (now = Date.now()): QuarterRef[] => {
  const current = quarterOf(now);
  return [-4, -3, -2, -1, 0, 1].map((step) => shiftQuarter(current, step)).reverse();
};

const percent = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 100);

/**
 * The headline figures at the quarter's latest week. Points when the work is estimated,
 * issues otherwise, so an unestimated team still sees its progress.
 */
export function quarterTotals(report: QuarterReport) {
  const last = report.weeks.at(-1);
  const byPoints = (last?.scopePoints ?? 0) > 0;
  const scope = (byPoints ? last?.scopePoints : last?.scopeIssues) ?? 0;
  const completed = (byPoints ? last?.completedPoints : last?.completedIssues) ?? 0;
  return {
    byPoints,
    unit: byPoints ? 'points' : 'issues',
    scope,
    completed,
    done: percent(completed, scope),
    elapsed: Math.round(report.elapsed * 100),
    completedIssues: last?.completedIssues ?? 0,
    scopeIssues: last?.scopeIssues ?? 0,
  };
}

/** Progress of one epic: its points when estimated, its issues otherwise. */
export const epicProgress = (epic: QuarterReport['epics'][number]) =>
  epic.points > 0 ? percent(epic.donePoints, epic.points) : percent(epic.doneIssues, epic.issues);

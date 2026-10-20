import type { BurndownPoint, FlowReportDay, Sprint } from '@bemmoly/module-work/shared';

/* The arithmetic the Reports screen draws: day labels, the guideline, running totals. */

export const RANGES = ['14', '30', '90'] as const;
export type ReportRange = (typeof RANGES)[number];
export const RANGE_LABELS: Record<ReportRange, string> = {
  '14': '14 days',
  '30': '30 days',
  '90': '90 days',
};
export const isRange = (value: string | null): value is ReportRange =>
  (RANGES as readonly string[]).includes(value ?? '');

const DAY_LABEL = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** "2026-03-10" → "Mar 10", read as the UTC day the server counted it in. */
export const dayLabel = (date: string) => DAY_LABEL.format(new Date(`${date}T00:00:00Z`));

/** The sprints a report can be drawn for: started ones, the active first, then latest closed. */
export function reportableSprints(sprints: readonly Sprint[]): Sprint[] {
  const rank = (sprint: Sprint) => (sprint.state === 'active' ? 0 : 1);
  return sprints
    .filter((sprint) => sprint.startedAt !== null)
    .sort(
      (a, b) => rank(a) - rank(b) || Date.parse(b.startedAt ?? '') - Date.parse(a.startedAt ?? ''),
    );
}

/** A straight line from the first day's points to zero on the last day. */
export function guideline(points: readonly BurndownPoint[]): number[] {
  const first = points[0]?.remainingPoints ?? 0;
  const span = Math.max(1, points.length - 1);
  return points.map((_, index) => Math.round(first * (1 - index / span) * 100) / 100);
}

/** Created and resolved as running totals from the first day of the range. */
export function runningTotals(days: readonly FlowReportDay[]) {
  let created = 0;
  let resolved = 0;
  return days.map((day) => {
    created += day.created;
    resolved += day.resolved;
    return { date: day.date, created, resolved };
  });
}

export const points = (value: number | null) => (value === null ? 'Unestimated' : `${value} pts`);

/** A part of a whole as a rounded percentage; nothing of nothing is 0%. */
export const share = (part: number, whole: number) =>
  `${whole > 0 ? Math.round((part / whole) * 100) : 0}%`;

/** "2 issues, 7 pts". */
export const issuesAndPoints = (issues: number, value: number) =>
  `${issues} ${issues === 1 ? 'issue' : 'issues'}, ${value} pts`;

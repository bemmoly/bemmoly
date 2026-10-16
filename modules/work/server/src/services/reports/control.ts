import type { ControlPoint } from '../../../../shared/reports.ts';
import type { Completion } from '../metrics/flow.ts';

/*
 * The control chart: every issue finished in the window with its cycle time,
 * and the mean and median the chart draws as reference lines.
 */

const DAY = 24 * 60 * 60 * 1000;
const round = (days: number) => Math.round(days * 10) / 10;

export interface ControlIssue {
  key: string;
  title: string;
}

export function controlPoints(
  completions: readonly Completion[],
  issues: ReadonlyMap<string, ControlIssue>,
  start: number,
): ControlPoint[] {
  return completions
    .filter((completion) => completion.completedAt >= start)
    .flatMap((completion) => {
      const issue = issues.get(completion.issueId);
      if (!issue) return [];
      return [
        {
          issueId: completion.issueId,
          key: issue.key,
          title: issue.title,
          completedAt: new Date(completion.completedAt).toISOString(),
          cycleDays: round(Math.max(0, completion.completedAt - completion.startedAt) / DAY),
        },
      ];
    })
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
}

export function cycleStats(points: readonly ControlPoint[]) {
  if (points.length === 0) return { meanDays: null, medianDays: null };
  const days = points.map((point) => point.cycleDays).sort((a, b) => a - b);
  const middle = Math.floor(days.length / 2);
  const median =
    days.length % 2 === 1 ? days[middle] : ((days[middle - 1] ?? 0) + (days[middle] ?? 0)) / 2;
  return {
    meanDays: round(days.reduce((sum, value) => sum + value, 0) / days.length),
    medianDays: round(median ?? 0),
  };
}

import type { TimeTrackingReport } from '../../../../shared/report-time-tracking.ts';
import { utcDate } from '../metrics/burndown.ts';

/*
 * The time tracking report's arithmetic, kept apart from the read so it can be tested without
 * a database: the logs in a window summed by week, by person and by issue.
 */

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
/** The issue list stops here; a longer list is a table, not a report. */
export const ISSUE_LIMIT = 50;

export interface TimeLog {
  issueId: string;
  key: string;
  title: string;
  estimate: number | null;
  userId: string;
  name: string;
  minutes: number;
  startedAt: number;
}

export interface TimeWindow {
  /** The first instant counted, the start of a UTC day. */
  start: number;
  /** The last instant counted (now, or a sprint's close). */
  end: number;
}

/** Most first; ties fall back to the label so the order is stable between reads. */
const byMinutes =
  <T extends { minutes: number }>(label: (item: T) => string) =>
  (a: T, b: T) =>
    b.minutes - a.minutes || label(a).localeCompare(label(b));

export function timeTracking(logs: readonly TimeLog[], window: TimeWindow): TimeTrackingReport {
  // Weeks run from the window's start rather than from Monday, so the first bar is a full week.
  const weekCount = Math.max(1, Math.ceil((window.end - window.start + 1) / WEEK));
  const weeks = Array.from({ length: weekCount }, (_, index) => ({
    date: utcDate(window.start + index * WEEK),
    minutes: 0,
  }));
  const people = new Map<string, TimeTrackingReport['people'][number]>();
  const issues = new Map<string, TimeTrackingReport['issues'][number]>();
  let totalMinutes = 0;

  for (const log of logs) {
    if (log.startedAt < window.start || log.startedAt > window.end) continue;
    totalMinutes += log.minutes;
    const week = weeks[Math.floor((log.startedAt - window.start) / WEEK)];
    if (week) week.minutes += log.minutes;
    const person = people.get(log.userId) ?? { userId: log.userId, name: log.name, minutes: 0 };
    person.minutes += log.minutes;
    people.set(log.userId, person);
    const issue = issues.get(log.issueId) ?? {
      issueId: log.issueId,
      key: log.key,
      title: log.title,
      estimate: log.estimate,
      minutes: 0,
    };
    issue.minutes += log.minutes;
    issues.set(log.issueId, issue);
  }

  return {
    from: utcDate(window.start),
    to: utcDate(window.end),
    totalMinutes,
    weeks,
    people: [...people.values()].sort(byMinutes((person) => person.name)),
    issues: [...issues.values()].sort(byMinutes((issue) => issue.key)).slice(0, ISSUE_LIMIT),
  };
}

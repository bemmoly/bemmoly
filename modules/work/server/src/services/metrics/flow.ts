/*
 * Kanban flow from status transitions: an issue completes when it last
 * entered a done status, and its cycle starts when it first entered an
 * in-progress status (or when it was created, for work that skipped one).
 */

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

/** Weeks in the throughput sparkline; the per-week figure averages the last four. */
export const THROUGHPUT_WEEKS = 8;
const AVERAGE_WEEKS = 4;
const CYCLE_WINDOW = 30 * DAY;

export interface FlowIssue {
  id: string;
  createdAt: number;
  resolvedAt: number | null;
  statusId: string;
}

export interface StatusChange {
  issueId: string;
  to: string;
  at: number;
}

export interface FlowInput {
  /** Issues now in a done status; open work never counts toward flow. */
  issues: readonly FlowIssue[];
  changes: readonly StatusChange[];
  done: ReadonlySet<string>;
  inProgress: ReadonlySet<string>;
  now: number;
}

export interface Flow {
  cycleTimeDays: number | null;
  throughputPerWeek: number;
  /** Completions per week, oldest first, the last bucket ending now. */
  throughputHistory: number[];
}

export interface Completion {
  issueId: string;
  startedAt: number;
  completedAt: number;
}

/** When each done issue completed and when its cycle began. */
export function completions(input: FlowInput): Completion[] {
  const byIssue = new Map<string, StatusChange[]>();
  for (const change of input.changes) {
    const list = byIssue.get(change.issueId) ?? [];
    list.push(change);
    byIssue.set(change.issueId, list);
  }
  const result: Completion[] = [];
  for (const issue of input.issues) {
    if (!input.done.has(issue.statusId)) continue;
    const changes = (byIssue.get(issue.id) ?? []).sort((a, b) => a.at - b.at);
    const intoDone = changes.filter((change) => input.done.has(change.to)).at(-1);
    const completedAt = intoDone?.at ?? issue.resolvedAt;
    if (completedAt === null || completedAt === undefined) continue;
    const started = changes.find(
      (change) => input.inProgress.has(change.to) && change.at <= completedAt,
    );
    result.push({ issueId: issue.id, startedAt: started?.at ?? issue.createdAt, completedAt });
  }
  return result;
}

export function flowMetrics(input: FlowInput): Flow {
  const done = completions(input);
  const history = Array.from({ length: THROUGHPUT_WEEKS }, () => 0);
  for (const completion of done) {
    const age = input.now - completion.completedAt;
    if (age < 0) continue;
    const bucket = THROUGHPUT_WEEKS - 1 - Math.floor(age / WEEK);
    if (bucket >= 0) history[bucket] = (history[bucket] ?? 0) + 1;
  }
  const recent = history.slice(-AVERAGE_WEEKS).reduce((sum, count) => sum + count, 0);
  const cycles = done
    .filter((completion) => input.now - completion.completedAt <= CYCLE_WINDOW)
    .map((completion) => Math.max(0, completion.completedAt - completion.startedAt) / DAY);
  const cycleTimeDays =
    cycles.length === 0
      ? null
      : Math.round((cycles.reduce((sum, days) => sum + days, 0) / cycles.length) * 10) / 10;
  return {
    cycleTimeDays,
    throughputPerWeek: Math.round((recent / AVERAGE_WEEKS) * 100) / 100,
    throughputHistory: history,
  };
}

/** How far back flow reads history: the sparkline's span. */
export const flowWindowStart = (now: number): number => now - THROUGHPUT_WEEKS * WEEK;

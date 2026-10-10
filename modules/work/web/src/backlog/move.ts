import { between, type Backlog, type Issue, type MoveIssueBody } from '@bemmoly/module-work/shared';
import { BACKLOG_ID, containersOf } from './model.ts';

/*
 * A drop, planned before anything is sent: where the issues land, the
 * provisional ranks the screen shows at once, and the server calls that make
 * it so. The server ranks each issue between the neighbours it is given, so
 * a block of issues goes one call at a time, each after the one before it.
 */

export interface DropTarget {
  containerId: string;
  /** The visible row the issues land above; null drops them after the last visible row. */
  beforeId: string | null;
}

export interface MoveCall {
  issueId: string;
  key: string;
  body: MoveIssueBody;
}

export interface MovePlan {
  /** The backlog as it looks after the drop, with provisional ranks. */
  backlog: Backlog;
  calls: MoveCall[];
}

/** Ids in screen order: containers top to bottom, rows in rank order. */
export function inScreenOrder(backlog: Backlog, ids: Iterable<string>): string[] {
  const wanted = new Set(ids);
  return containersOf(backlog).flatMap((container) =>
    container.issues.filter((issue) => wanted.has(issue.id)).map((issue) => issue.id),
  );
}

/**
 * Where in the container's full list the block goes. The target names a
 * visible row; with filters on, hidden rows sit between visible ones and the
 * block lands directly above the named row, or directly below the last
 * visible row when it names none.
 */
export function insertionIndex(
  rest: readonly Issue[],
  visibleIds: readonly string[],
  moving: ReadonlySet<string>,
  beforeId: string | null,
): number {
  let anchor = beforeId;
  if (anchor && moving.has(anchor)) {
    const from = visibleIds.indexOf(anchor);
    anchor = visibleIds.slice(from + 1).find((id) => !moving.has(id)) ?? null;
  }
  if (anchor) {
    const at = rest.findIndex((issue) => issue.id === anchor);
    if (at >= 0) return at;
  }
  const lastVisible = visibleIds.filter((id) => !moving.has(id)).at(-1);
  const after = lastVisible ? rest.findIndex((issue) => issue.id === lastVisible) : -1;
  return after >= 0 ? after + 1 : rest.length;
}

/** A rank between two neighbours, or the old one when the neighbours are out of order. */
function provisional(lower: Issue | undefined, upper: Issue | undefined, fallback: string) {
  try {
    return between(lower?.rank ?? null, upper?.rank ?? null);
  } catch {
    return fallback;
  }
}

/** A container's committed points, to two decimals like the server. */
export const sumPoints = (issues: readonly Issue[]) =>
  Math.round(issues.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0) * 100) / 100;

export function planMove(
  backlog: Backlog,
  ids: readonly string[],
  target: DropTarget,
  visibleIds: readonly string[],
): MovePlan | null {
  const containers = containersOf(backlog);
  const destination = containers.find((container) => container.id === target.containerId);
  if (!destination) return null;
  const home = new Map<string, string>();
  for (const container of containers) {
    for (const issue of container.issues) home.set(issue.id, container.id);
  }
  const order = inScreenOrder(backlog, ids);
  if (order.length === 0) return null;
  const moving = new Set(order);
  const byId = new Map(containers.flatMap((c) => c.issues.map((issue) => [issue.id, issue])));
  const rest = destination.issues.filter((issue) => !moving.has(issue.id));
  const at = insertionIndex(rest, visibleIds, moving, target.beforeId);
  const sprintId = destination.sprint?.id ?? null;
  const block = order.map((id) => byId.get(id)).filter((issue) => issue !== undefined);
  const placed = [...rest.slice(0, at), ...block, ...rest.slice(at)];

  const unchanged =
    block.every((issue) => home.get(issue.id) === destination.id) &&
    placed.every((issue, index) => issue.id === destination.issues[index]?.id);
  if (unchanged) return null;

  const upper = placed[at + block.length];
  const calls: MoveCall[] = [];
  const landed: Issue[] = [];
  block.forEach((issue, k) => {
    const lower = k === 0 ? placed[at - 1] : landed[k - 1];
    const crosses = home.get(issue.id) !== destination.id;
    calls.push({
      issueId: issue.id,
      key: issue.key,
      body: {
        beforeIssueId: lower?.id ?? null,
        afterIssueId: upper?.id ?? null,
        ...(crosses ? { sprintId } : {}),
      },
    });
    landed.push({ ...issue, sprintId, rank: provisional(lower, upper, issue.rank) });
  });
  const result = [...rest.slice(0, at), ...landed, ...rest.slice(at)];

  const without = (issues: readonly Issue[]) => issues.filter((issue) => !moving.has(issue.id));
  const listFor = (id: string, issues: readonly Issue[]) =>
    id === destination.id ? result : without(issues);
  return {
    calls,
    backlog: {
      ...backlog,
      sprints: backlog.sprints.map((entry) => {
        const issues = listFor(entry.sprint.id, entry.issues);
        return {
          ...entry,
          issues,
          committedPoints: sumPoints(issues),
          committedIssues: issues.length,
        };
      }),
      issues: listFor(BACKLOG_ID, backlog.issues),
    },
  };
}

/** Writes the server's answer for one issue over its provisional copy. */
export function reconcileIssue(backlog: Backlog, issue: Issue): Backlog {
  const swap = (issues: Issue[]) => issues.map((row) => (row.id === issue.id ? issue : row));
  return {
    ...backlog,
    sprints: backlog.sprints.map((entry) => ({ ...entry, issues: swap(entry.issues) })),
    issues: swap(backlog.issues),
  };
}

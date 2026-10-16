/*
 * How long issues stand in each status inside a window: every issue's status
 * at the window's start is rewound from its current one, then each move
 * closes one stay and opens the next. A stay still open runs to the end.
 */

export interface StayIssue {
  id: string;
  statusId: string;
  createdAt: number;
  deletedAt: number | null;
}

export interface StatusMove {
  issueId: string;
  from: string | null;
  to: string | null;
  at: number;
}

export interface StatusStays {
  /** Milliseconds spent in the status inside the window, summed over issues. */
  totalMs: number;
  /** Issues that stood in the status at some point inside the window. */
  issues: number;
}

export function statusStays(
  issues: readonly StayIssue[],
  moves: readonly StatusMove[],
  start: number,
  end: number,
): Map<string, StatusStays> {
  const byIssue = new Map<string, StatusMove[]>();
  for (const move of moves) {
    const list = byIssue.get(move.issueId) ?? [];
    list.push(move);
    byIssue.set(move.issueId, list);
  }
  const totals = new Map<string, { totalMs: number; issues: Set<string> }>();
  const add = (statusId: string, issueId: string, from: number, to: number) => {
    if (to <= from) return;
    const entry = totals.get(statusId) ?? { totalMs: 0, issues: new Set<string>() };
    entry.totalMs += to - from;
    entry.issues.add(issueId);
    totals.set(statusId, entry);
  };

  for (const issue of issues) {
    const first = Math.max(start, issue.createdAt);
    const last = Math.min(end, issue.deletedAt ?? end);
    if (last <= first) continue;
    const ordered = (byIssue.get(issue.id) ?? []).sort((a, b) => a.at - b.at);
    // Rewind the current status past every move after the stay window opens.
    let status = issue.statusId;
    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      const move = ordered[index];
      if (!move || move.at <= first) break;
      if (move.from !== null) status = move.from;
    }
    let since = first;
    for (const move of ordered) {
      if (move.at <= first) continue;
      if (move.at >= last) break;
      add(status, issue.id, since, move.at);
      if (move.to !== null) status = move.to;
      since = move.at;
    }
    add(status, issue.id, since, last);
  }
  return new Map(
    [...totals].map(([statusId, entry]) => [
      statusId,
      { totalMs: entry.totalMs, issues: entry.issues.size },
    ]),
  );
}

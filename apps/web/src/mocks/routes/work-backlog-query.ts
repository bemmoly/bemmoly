import type { MockDb } from '../db.ts';
import type { BacklogIssueRow } from '../seed/work-backlog.ts';
import type { MockIssue } from '../seed/work-board.ts';
import { WORK_IDS } from '../seed/work-settings.ts';
import { compileLql } from './work-board-lql.ts';
import { lqlContext } from './work-board-view.ts';
import { workState } from './work-state.ts';

/*
 * The Backlog read's query and sort rules over the mock's issues, the way the server's
 * backlog service compiles them: the board's sort rules first (a match rule lifts what it
 * matches, a field rule orders by that field), then the query's ORDER BY, then rank; the
 * query's WHERE keeps the rows it matches.
 */

type SortRule =
  | { kind: 'match'; name: string; query: string }
  | { kind: 'field'; field: string; direction?: 'asc' | 'desc' };

type Compare = (a: BacklogIssueRow, b: BacklogIssueRow) => number;

export interface BacklogQueryAnswer {
  keep: (issue: BacklogIssueRow) => boolean;
  /** Null when nothing sorts the lists: they stay in rank order. */
  order: Compare | null;
  boardId: string | null;
}

const asMock = (issue: BacklogIssueRow) => issue as unknown as MockIssue;

function rulesOf(db: MockDb, boardId: string | null) {
  const boards = workState(db).boards.filter((board) => board['projectId'] === WORK_IDS.project);
  const board = boardId ? boards.find((row) => row.id === boardId) : boards[0];
  const config = board?.['config'] as { backlog?: { sortRules?: SortRule[] } } | undefined;
  return { board, rules: config?.backlog?.sortRules ?? [] };
}

/** The query and rules compiled, or the first problem in them as the server would answer 400. */
export function backlogQuery(
  db: MockDb,
  q: string | null,
  boardId: string | null,
): BacklogQueryAnswer | { error: string } {
  const { board, rules } = rulesOf(db, boardId);
  if (boardId && !board) return { error: 'The board is not one of this project' };
  const ctx = lqlContext(db);
  const compares: Compare[] = [];
  for (const rule of rules) {
    const text =
      rule.kind === 'match'
        ? rule.query
        : `ORDER BY ${rule.field} ${(rule.direction ?? 'asc').toUpperCase()}`;
    const compiled = compileLql(text, ctx);
    if (!compiled.ok) return { error: compiled.error.message };
    const order = compiled.order;
    if (rule.kind === 'match') {
      compares.push(
        (a, b) => Number(!compiled.test(asMock(a))) - Number(!compiled.test(asMock(b))),
      );
    } else if (order) {
      compares.push((a, b) => order(asMock(a), asMock(b)));
    }
  }
  let keep = (_issue: BacklogIssueRow) => true;
  if (q) {
    const compiled = compileLql(q, ctx);
    if (!compiled.ok) return { error: compiled.error.message };
    keep = (issue) => compiled.test(asMock(issue));
    const order = compiled.order;
    if (order) compares.push((a, b) => order(asMock(a), asMock(b)));
  }
  const order: Compare | null =
    compares.length === 0
      ? null
      : (a, b) => {
          for (const compare of compares) {
            const result = compare(a, b);
            if (result !== 0) return result;
          }
          return 0;
        };
  return { keep, order, boardId: board?.id ?? null };
}

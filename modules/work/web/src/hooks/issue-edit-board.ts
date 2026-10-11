import type { BoardView } from '@bemmoly/module-work/shared';
import { stillHeld, type QuickPatch } from './issue-edit-patch.ts';

/*
 * A quick edit on a cached board view, pure. Assignee and priority change on the card (and its
 * lane, when the board's lanes are by assignee or priority); a move to another sprint takes the
 * card off a board showing a sprint, with its column's count. Taking one back touches only the
 * fields that still hold the edit, so a later edit or a fresher read is never undone.
 */

type Card = BoardView['cards'][number];

/** The lane a card belongs in under the board's lanes, or its current one when it cannot move. */
function laneOf(view: BoardView, card: Card): string {
  const kind = view.board.config.lanes.kind;
  const wanted =
    kind === 'assignee' ? (card.assigneeId ?? 'none') : kind === 'priority' ? card.priority : null;
  if (wanted === null || !view.lanes.some((lane) => lane.id === wanted)) return card.laneId;
  return wanted;
}

/** True when the edit moves the issue off this board: it shows one sprint and this is another. */
export function leavesBoard(view: BoardView, patch: QuickPatch): boolean {
  return patch.sprintId !== undefined && view.sprintId !== null && patch.sprintId !== view.sprintId;
}

function recount(view: BoardView, columnId: string, delta: number): BoardView['columns'] {
  return view.columns.map((column) => {
    if (column.id !== columnId) return column;
    const count = Math.max(0, column.count + delta);
    return { ...column, count, overWip: column.wipLimit !== null && count > column.wipLimit };
  });
}

export function patchBoardView(view: BoardView, key: string, patch: QuickPatch): BoardView {
  const card = view.cards.find((entry) => entry.key === key);
  if (!card) return view;
  if (leavesBoard(view, patch)) {
    return {
      ...view,
      cards: view.cards.filter((entry) => entry !== card),
      columns: recount(view, card.columnId, -1),
    };
  }
  const next: Card = { ...card };
  if (patch.assigneeId !== undefined) next.assigneeId = patch.assigneeId;
  if (patch.priority !== undefined) next.priority = patch.priority;
  next.laneId = laneOf(view, next);
  return { ...view, cards: view.cards.map((entry) => (entry === card ? next : entry)) };
}

/**
 * Takes a failed edit back. `before` is the card as the view held it before the edit. A card
 * the edit took off the board comes back where it was; one still on it gets back only the
 * fields that still hold the edit's values.
 */
export function revertBoardView(view: BoardView, before: Card, patch: QuickPatch): BoardView {
  const card = view.cards.find((entry) => entry.issueId === before.issueId);
  if (!card) {
    if (!leavesBoard(view, patch)) return view;
    return {
      ...view,
      cards: [...view.cards, before],
      columns: recount(view, before.columnId, 1),
    };
  }
  const fields = stillHeld(card, patch);
  const next: Card = { ...card };
  if (fields.includes('assigneeId')) next.assigneeId = before.assigneeId;
  if (fields.includes('priority')) next.priority = before.priority;
  if (next.assigneeId === card.assigneeId && next.priority === card.priority) return view;
  next.laneId = laneOf(view, next);
  return { ...view, cards: view.cards.map((entry) => (entry === card ? next : entry)) };
}

import { between, type AvailableTransition, type BoardView } from '@bemmoly/module-work/shared';
import type { BoardModel, ColumnModel, ViewCard } from './board-model.ts';

/*
 * The drag rules, pure: where a drop lands, whether the workflow allows it, the neighbours and
 * provisional rank the server is asked for, and the optimistic view while it answers.
 */

/** A slot in one lane's column: `index` counts the cards there without the dragged one. */
export interface DropTarget {
  laneId: string;
  columnId: string;
  index: number;
}

export type ColumnVerdict =
  { allowed: true; statusId: string } | { allowed: false; reason: string };

export interface MovePlan {
  issueId: string;
  key: string;
  fromColumnId: string;
  toColumnId: string;
  /** The status to transition into, or null for a reorder within the column. */
  statusId: string | null;
  beforeIssueId: string | null;
  afterIssueId: string | null;
  /** What the server will most likely write; the optimistic view sorts by it. */
  rank: string;
}

const others = (cards: readonly ViewCard[], issueId: string) =>
  cards.filter((card) => card.issueId !== issueId);

/**
 * Whether a card may enter a column. Without the issue's transitions yet, the drop is offered
 * into the column's first status and the server decides; with them, only a status an
 * available transition reaches is allowed, and a blocked one names its reason.
 */
export function judgeColumn(
  column: ColumnModel,
  currentStatusId: string,
  transitions: readonly AvailableTransition[] | undefined,
): ColumnVerdict {
  if (column.statusIds.includes(currentStatusId))
    return { allowed: true, statusId: currentStatusId };
  const first = column.statusIds[0];
  if (!transitions) {
    return first ? { allowed: true, statusId: first } : { allowed: false, reason: 'No status' };
  }
  const into = transitions.filter((transition) => column.statusIds.includes(transition.toStatusId));
  const open = into.find((transition) => transition.available);
  if (open) return { allowed: true, statusId: open.toStatusId };
  const blocked = into[0];
  if (blocked) {
    return {
      allowed: false,
      reason: blocked.blockedBy[0] ?? `"${blocked.name}" is blocked for this issue`,
    };
  }
  return { allowed: false, reason: `No transition leads from this status to ${column.name}` };
}

/** The drop as the server will be asked for it, or null when it would change nothing. */
export function planMove(
  model: BoardModel,
  card: ViewCard,
  from: DropTarget,
  to: DropTarget,
  statusId: string,
): MovePlan | null {
  const lane = model.lanes.find((entry) => entry.id === to.laneId);
  const cell = others(lane?.cells[to.columnId] ?? [], card.issueId);
  const index = Math.max(0, Math.min(to.index, cell.length));
  const sameColumn = from.columnId === to.columnId;
  if (sameColumn && from.laneId === to.laneId && index === from.index) return null;
  const before = cell[index - 1] ?? null;
  const after = cell[index] ?? null;
  let rank = card.rank;
  try {
    rank = between(before?.rank ?? null, after?.rank ?? null);
  } catch {
    // Neighbours out of order mean the view is stale; the server's answer will reorder it.
  }
  return {
    issueId: card.issueId,
    key: card.key,
    fromColumnId: from.columnId,
    toColumnId: to.columnId,
    statusId: sameColumn ? null : statusId,
    beforeIssueId: before?.issueId ?? null,
    afterIssueId: after?.issueId ?? null,
    rank,
  };
}

/** Where a card sits in a view: what a move changes and a refusal puts back. */
export type CardPlacement = Pick<
  BoardView['cards'][number],
  'columnId' | 'statusId' | 'rank' | 'ageDays'
>;

export function placementOf(view: BoardView, issueId: string): CardPlacement | null {
  const card = view.cards.find((entry) => entry.issueId === issueId);
  if (!card) return null;
  return {
    columnId: card.columnId,
    statusId: card.statusId,
    rank: card.rank,
    ageDays: card.ageDays,
  };
}

/** One card placed anew, with the WIP counts of the columns it left and entered. */
function place(view: BoardView, issueId: string, from: string, to: CardPlacement): BoardView {
  const cards = view.cards.map((card) => (card.issueId === issueId ? { ...card, ...to } : card));
  if (from === to.columnId) return { ...view, cards };
  const columns = view.columns.map((column) => {
    const delta = column.id === to.columnId ? 1 : column.id === from ? -1 : 0;
    if (delta === 0) return column;
    const count = Math.max(0, column.count + delta);
    return { ...column, count, overWip: column.wipLimit !== null && count > column.wipLimit };
  });
  return { ...view, cards, columns };
}

/** The view with the move applied: the card's column, status and rank, and the WIP counts. */
export function applyMove(view: BoardView, plan: MovePlan): BoardView {
  const card = placementOf(view, plan.issueId);
  if (!card) return view;
  return place(view, plan.issueId, card.columnId, {
    columnId: plan.toColumnId,
    statusId: plan.statusId ?? card.statusId,
    rank: plan.rank,
    ageDays: plan.statusId ? 0 : card.ageDays,
  });
}

/**
 * The view with a refused move taken back for its own card only, so other cards whose moves
 * are still in flight stay where they were dropped. A card that has left the place this move
 * gave it, by a later drop or a fresher read, is not touched: the read after the last move
 * settles has the server's word on it.
 */
export function revertMove(view: BoardView, plan: MovePlan, before: CardPlacement): BoardView {
  const card = placementOf(view, plan.issueId);
  if (!card || card.columnId !== plan.toColumnId || card.rank !== plan.rank) return view;
  return place(view, plan.issueId, card.columnId, before);
}

export type StepKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

/**
 * The next slot for a card carried with the keyboard: up and down within the cell, left and
 * right to the neighbouring column of the same lane, keeping the row where it fits.
 */
export function stepTarget(
  model: BoardModel,
  issueId: string,
  target: DropTarget,
  key: StepKey,
): DropTarget {
  const lane = model.lanes.find((entry) => entry.id === target.laneId);
  if (!lane) return target;
  const size = (columnId: string) => others(lane.cells[columnId] ?? [], issueId).length;
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const index = target.index + (key === 'ArrowUp' ? -1 : 1);
    return { ...target, index: Math.max(0, Math.min(index, size(target.columnId))) };
  }
  const at = model.columns.findIndex((column) => column.id === target.columnId);
  const next = model.columns[at + (key === 'ArrowLeft' ? -1 : 1)];
  if (!next) return target;
  return { ...target, columnId: next.id, index: Math.min(target.index, size(next.id)) };
}

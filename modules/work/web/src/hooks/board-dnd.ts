import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { api, workKeys } from '../shared/index.ts';
import { judgeColumn, planMove, type ColumnVerdict, type DropTarget } from './board-drag.ts';
import { useBoardDragStore, type CarriedCard } from './board-drag-store.ts';
import type { BoardModel, ViewCard } from './board-model.ts';
import { useBoardMove } from './board-move.ts';

/*
 * Drag and drop for the board, by pointer and by keyboard, over one set of rules: a card stays
 * in its lane, may be reordered in its column, and may enter another column only when the
 * workflow has an available transition into one of its statuses. The issue's transitions are
 * fetched the moment it is picked up, so forbidden columns show why before the drop. Nothing
 * here subscribes to the carried card, so picking one up never re-renders the screen.
 */

export interface CardPlace {
  card: ViewCard;
  laneId: string;
  columnId: string;
  index: number;
}

export function placesOf(model: BoardModel): Map<string, CardPlace> {
  const places = new Map<string, CardPlace>();
  for (const lane of model.lanes) {
    for (const [columnId, cards] of Object.entries(lane.cells)) {
      cards.forEach((card, index) =>
        places.set(card.issueId, { card, laneId: lane.id, columnId, index }),
      );
    }
  }
  return places;
}

/**
 * The carried card's transitions and what they mean for each column, kept in the drag store
 * for the cells to read. Lives in its own small component so only it re-renders on pick-up.
 */
export function useBoardVerdicts(model: BoardModel) {
  const carrying = useBoardDragStore((state) => state.carrying);
  const transitions = useQuery({
    // Keyed by the status too: the transitions of the status a card just left must not judge
    // its next drop while they are refetched.
    queryKey: [...workKeys.issueTransitions(carrying?.key ?? ''), carrying?.statusId ?? ''],
    queryFn: () => api.work.boardIssues.transitions(carrying?.key ?? ''),
    enabled: Boolean(carrying),
    staleTime: 15_000,
    retry: false,
  });
  const known = transitions.isSuccess ? transitions.data : undefined;
  const verdicts = useMemo<Readonly<Record<string, ColumnVerdict>> | null>(() => {
    if (!carrying) return null;
    return Object.fromEntries(
      model.columns.map((column) => [column.id, judgeColumn(column, carrying.statusId, known)]),
    );
  }, [carrying, model.columns, known]);
  useEffect(() => useBoardDragStore.getState().setVerdicts(verdicts), [verdicts]);
}

const announce = (text: string) => useBoardDragStore.getState().announce(text);

export function useBoardDnd(model: BoardModel, boardId: string) {
  const places = useMemo(() => placesOf(model), [model]);
  const columnName = useCallback(
    (columnId: string) => model.columns.find((column) => column.id === columnId)?.name ?? columnId,
    [model.columns],
  );
  const { move, refuse } = useBoardMove(boardId, columnName);

  const pick = useCallback(
    (issueId: string, mode: CarriedCard['mode']) => {
      const place = places.get(issueId);
      if (!place) return;
      const { card, laneId, columnId, index } = place;
      useBoardDragStore.getState().pick({
        issueId,
        key: card.key,
        statusId: card.statusId,
        from: { laneId, columnId, index },
        mode,
      });
      if (mode === 'keyboard')
        announce(`Picked up ${card.key}. Arrow keys move it, space drops it, Escape puts it back.`);
    },
    [places],
  );

  const drop = useCallback(() => {
    const verdicts = useBoardDragStore.getState().verdicts;
    const done = useBoardDragStore.getState().finish();
    if (!done?.target) return;
    const { carrying: carried, target } = done;
    const place = places.get(carried.issueId);
    const column = model.columns.find((entry) => entry.id === target.columnId);
    if (!place || !column) return;
    const verdict = verdicts?.[column.id] ?? judgeColumn(column, carried.statusId, undefined);
    if (!verdict.allowed) {
      refuse(carried.key, column.id, verdict.reason);
      announce(`${carried.key} cannot move to ${column.name}. ${verdict.reason}`);
      return;
    }
    const plan = planMove(model, place.card, carried.from, target, verdict.statusId);
    if (!plan) {
      announce(`${carried.key} dropped where it was.`);
      return;
    }
    move(plan);
    announce(`${carried.key} moved to ${column.name}, position ${target.index + 1}.`);
  }, [places, model, refuse, move]);

  const cancel = useCallback(() => {
    const done = useBoardDragStore.getState().finish();
    if (done) announce(`${done.carrying.key} put back.`);
  }, []);

  const over = useCallback(
    (target: DropTarget) => {
      const current = useBoardDragStore.getState();
      if (!current.carrying || current.carrying.from.laneId !== target.laneId) return false;
      current.over(target);
      if (current.carrying.mode === 'keyboard') {
        const verdict = current.verdicts?.[target.columnId];
        const name = columnName(target.columnId);
        announce(
          verdict && !verdict.allowed
            ? `${name}: not allowed. ${verdict.reason}`
            : `${name}, position ${target.index + 1}.`,
        );
      }
      return true;
    },
    [columnName],
  );

  return { places, pick, over, drop, cancel };
}

export type BoardDnd = ReturnType<typeof useBoardDnd>;

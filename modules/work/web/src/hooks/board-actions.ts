import { useEffect, useMemo, useRef, type DragEvent, type KeyboardEvent } from 'react';
import type { DropTarget } from './board-drag.ts';
import { useBoardDragStore } from './board-drag-store.ts';
import { useBoardDnd } from './board-dnd.ts';
import { handleCardKey } from './board-keys.ts';
import type { BoardModel } from './board-model.ts';

/*
 * The handlers every card and cell calls, made once per board. They read the latest model and
 * drag state through a ref, so passing them down never re-renders the cards.
 */

/** A drop index counts the cell's other cards; a card above the carried one shifts it by one. */
function withoutCarried(target: DropTarget): DropTarget {
  const from = useBoardDragStore.getState().carrying?.from;
  const sameCell = from?.laneId === target.laneId && from.columnId === target.columnId;
  return sameCell && from.index < target.index ? { ...target, index: target.index - 1 } : target;
}

export function useBoardActions(model: BoardModel, boardId: string, open: (key: string) => void) {
  const dnd = useBoardDnd(model, boardId);
  const live = useRef({ dnd, model, open });
  useEffect(() => {
    live.current = { dnd, model, open };
  });

  const actions = useMemo(() => {
    const over = (event: DragEvent, target: DropTarget) => {
      if (live.current.dnd.over(withoutCarried(target))) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
      }
    };
    return {
      open: (key: string) => {
        if (!useBoardDragStore.getState().carrying) live.current.open(key);
      },
      keyDown: (event: KeyboardEvent, issueId: string) => {
        const { dnd: current, model: board, open: openIssue } = live.current;
        handleCardKey(event, issueId, {
          model: board,
          places: current.places,
          pick: current.pick,
          over: (target) => current.over(target),
          drop: current.drop,
          cancel: current.cancel,
          open: openIssue,
        });
      },
      dragStart: (event: DragEvent, issueId: string) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', issueId);
        live.current.dnd.pick(issueId, 'pointer');
      },
      dragOver: (event: DragEvent, target: DropTarget) => over(event, target),
      dragOverCard: (event: DragEvent, issueId: string, below: boolean) => {
        // The card's place comes from the board as laid out now, so a card never needs to
        // re-render because a drop moved it up or down its cell.
        const place = live.current.dnd.places.get(issueId);
        if (!place) return;
        const { laneId, columnId, index } = place;
        over(event, { laneId, columnId, index: index + (below ? 1 : 0) });
      },
      dropHere: (event: DragEvent) => {
        if (!useBoardDragStore.getState().carrying) return;
        event.preventDefault();
        live.current.dnd.drop();
      },
      dragEnd: () => live.current.dnd.cancel(),
    };
  }, []);

  return actions;
}

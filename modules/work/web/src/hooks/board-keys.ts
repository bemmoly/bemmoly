import type { KeyboardEvent } from 'react';
import { stepTarget, type StepKey } from './board-drag.ts';
import { useBoardDragStore } from './board-drag-store.ts';
import type { BoardModel } from './board-model.ts';
import type { CardPlace } from './board-dnd.ts';
import { cellId, useBoardWindowStore } from './board-window.ts';

/*
 * The board's keyboard: cards are focusable; Enter opens one, space picks it up, the arrows
 * carry it (or, when nothing is carried, move focus between cards), space or Enter drops it
 * and Escape puts it back.
 */

const STEPS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export interface BoardKeyActions {
  model: BoardModel;
  places: ReadonlyMap<string, CardPlace>;
  pick(issueId: string, mode: 'keyboard'): void;
  over(target: CardPlace | { laneId: string; columnId: string; index: number }): boolean;
  drop(): void;
  cancel(): void;
  open(key: string): void;
}

export function focusCard(issueId: string): void {
  requestAnimationFrame(() => {
    const element = document.querySelector<HTMLElement>(`[data-issue-id="${issueId}"]`);
    element?.focus();
  });
}

/** The card next to a place in an arrow's direction, keeping lane and row where it can. */
export function neighbourOf(model: BoardModel, place: CardPlace, key: StepKey): string | null {
  const lane = model.lanes.find((entry) => entry.id === place.laneId);
  if (!lane) return null;
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const cell = lane.cells[place.columnId] ?? [];
    return cell[place.index + (key === 'ArrowUp' ? -1 : 1)]?.issueId ?? null;
  }
  const at = model.columns.findIndex((column) => column.id === place.columnId);
  const step = key === 'ArrowLeft' ? -1 : 1;
  for (let i = at + step; i >= 0 && i < model.columns.length; i += step) {
    const cell = lane.cells[model.columns[i]?.id ?? ''] ?? [];
    const card = cell[Math.min(place.index, cell.length - 1)];
    if (card) return card.issueId;
  }
  return null;
}

export function handleCardKey(event: KeyboardEvent, issueId: string, actions: BoardKeyActions) {
  const state = useBoardDragStore.getState();
  const carried = state.carrying?.issueId === issueId && state.carrying.mode === 'keyboard';
  const place = actions.places.get(issueId);
  if (!place) return;
  if (carried) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      useBoardDragStore.getState().keepFocus(issueId);
      actions.drop();
      focusCard(issueId);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      actions.cancel();
    } else if (STEPS.has(event.key)) {
      event.preventDefault();
      const from = state.target ?? place;
      const target = stepTarget(actions.model, issueId, from, event.key as StepKey);
      actions.over(target);
      useBoardWindowStore.getState().reveal(cellId(target.laneId, target.columnId), target.index);
    }
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    actions.open(place.card.key);
  } else if (event.key === ' ') {
    event.preventDefault();
    actions.pick(issueId, 'keyboard');
  } else if (STEPS.has(event.key)) {
    const next = neighbourOf(actions.model, place, event.key as StepKey);
    if (!next) return;
    event.preventDefault();
    const nextPlace = actions.places.get(next);
    if (nextPlace) {
      useBoardWindowStore
        .getState()
        .reveal(cellId(nextPlace.laneId, nextPlace.columnId), nextPlace.index);
    }
    focusCard(next);
  }
}

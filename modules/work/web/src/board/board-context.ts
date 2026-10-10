import { createContext, useContext, type DragEvent, type KeyboardEvent } from 'react';
import type { DropTarget } from '../hooks/board-drag.ts';
import type { CardVocabulary } from './card-view.ts';

/*
 * What every card and cell of the board shares. The actions are stable for the board's life
 * (they read the latest state through a ref), so a drag never re-renders every card.
 */

export interface BoardActions {
  open(key: string): void;
  keyDown(event: KeyboardEvent, issueId: string): void;
  dragStart(event: DragEvent, issueId: string): void;
  dragOver(event: DragEvent, target: DropTarget): void;
  dragEnd(): void;
  dropHere(event: DragEvent): void;
}

export interface BoardShared {
  actions: BoardActions;
  vocab: CardVocabulary;
  /** Fades cards the filters leave out; undefined when no filter is on. */
  isDimmed: ((issueId: string) => boolean) | undefined;
  /** The issue open in the slide-over; its card carries the selected ring. */
  selectedKey: string | null;
  /** The id of the hidden text that explains the keyboard to screen readers. */
  instructionsId: string;
}

export const BoardContext = createContext<BoardShared | null>(null);

export function useBoardShared(): BoardShared {
  const shared = useContext(BoardContext);
  if (!shared) throw new Error('Board cards render inside the board grid.');
  return shared;
}

export const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

/** The focus ring of the design system's interactive parts, for the card wrapper. */
export const FOCUS_RING = 'focus-ring';

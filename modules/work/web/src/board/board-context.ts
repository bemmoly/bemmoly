import { createContext, useContext, type DragEvent, type KeyboardEvent } from 'react';
import type { Density } from '../hooks/board-display.ts';
import type { DropTarget } from '../hooks/board-drag.ts';
import type { BoardSelectHandlers } from '../hooks/board-selection.ts';
import type { MenuSprint } from '../shared/issue-actions-menu.tsx';
import type { IssueQuickActions } from '../hooks/issue-quick-actions.ts';
import type { CardVocabulary } from './card-view.ts';

/*
 * What every card and cell of the board shares, and only what changes rarely: every card reads
 * it, so a change here redraws the whole board. The actions are stable for the board's life
 * (they read the latest state through a ref), and the open issue is not here: each card asks
 * the address whether it is the one, so opening an issue redraws two cards, not all of them.
 */

export interface BoardActions {
  open(key: string): void;
  keyDown(event: KeyboardEvent, issueId: string): void;
  dragStart(event: DragEvent, issueId: string): void;
  dragOver(event: DragEvent, target: DropTarget): void;
  /** Over a card: before it, or after it when `below`, wherever the board has it now. */
  dragOverCard(event: DragEvent, issueId: string, below: boolean): void;
  dragEnd(): void;
  dropHere(event: DragEvent): void;
}

export interface BoardShared {
  actions: BoardActions;
  vocab: CardVocabulary;
  /** Assign, priority and delete from a card's tools and menu. */
  quick: IssueQuickActions;
  /** Picking cards for the bulk bar; the card's menu and keys act on the selection. */
  select: BoardSelectHandlers;
  /** Where a card can move from its menu (Scrum only): the planned sprints and the Backlog. */
  sprints?: readonly MenuSprint[];
  /** This person's card density on this board. */
  density: Density;
  /**
   * A touch screen has no hover, so every card shows its tools from the start; elsewhere a card
   * draws them the first time the pointer or the focus reaches it.
   */
  touch: boolean;
  /** Creates an issue at the foot of a cell; absent when the person cannot create. */
  createIn?: (laneId: string, columnId: string, title: string) => Promise<unknown>;
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

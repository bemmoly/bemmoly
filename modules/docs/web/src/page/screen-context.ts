import type { DocEditorProps } from '@bemmoly/editor';
import { createContext, useContext } from 'react';
import { create } from 'zustand';
import type { PageDetail } from '../../../shared/pages.ts';
import type { CollabPage } from '../collab/use-collab-page.ts';
import type { DocStats } from './body/doc-stats.ts';
import type { PageSlotProps } from './slots.ts';
import type { OutlineEntry } from './toc/use-outline.ts';

export type PageEditor = NonNullable<Parameters<NonNullable<DocEditorProps['onEditor']>>[0]>;

/** Why the page cannot be changed right now, for the banner and the save state. */
export type ReadOnlyReason = 'archived' | 'trashed' | 'viewer' | null;

/** What the right margin shows: the outline, the comments or the linked work. */
export type MarginId = 'outline' | 'comments' | 'linked';

/** The page as written, or its version history in place of the body. */
export type PageMode = 'page' | 'history';

/** What the parts of the page screen share: the page, its live body and the margin. */
export interface PageScreenState {
  page: PageDetail;
  collab: CollabPage;
  /** True when the body, the title and the facts may change. */
  editable: boolean;
  readOnly: ReadOnlyReason;
  editor: PageEditor | null;
  /** Puts the caret at the start of the body, as Enter in the title does. */
  focusBody: () => void;
  /** The live document's headings and the one being read. */
  outline: readonly OutlineEntry[];
  activeHeading: string | null;
  /** Marks the heading the person just jumped to as the one being read. */
  pinHeading: (id: string) => void;
  /** True when the margin has room to sit beside the body; below that it opens over it. */
  docked: boolean;
  /** Words and reading time of the live document. */
  stats: DocStats;
}

export const PageScreenContext = createContext<PageScreenState | null>(null);

export function usePageScreen(): PageScreenState {
  const screen = useContext(PageScreenContext);
  if (!screen) throw new Error('usePageScreen is used inside the page screen');
  return screen;
}

interface PageChrome {
  /** What the right margin shows, or null while it is closed. */
  margin: MarginId | null;
  /**
   * True once the person chose the margin themselves. The outline is the margin's resting
   * state where it fits; it only opens over a narrow page when someone asked for it.
   */
  chosen: boolean;
  openMargin: (id: MarginId) => void;
  closeMargin: () => void;
  /** Shows `id`, or closes the margin when `id` is what it shows on screen now. */
  toggleMargin: (id: MarginId, shown: boolean) => void;
  mode: PageMode;
  setMode: (mode: PageMode) => void;
  /** Bumped when a margin opens from a key or a menu; the margin then takes focus. */
  focusRequest: number;
}

/**
 * The margin and the mode, kept across pages so the margin stays where the person left it
 * while they move through a space. The outline rests in the margin until someone picks
 * comments or linked work, or closes it.
 */
export const usePageChrome = create<PageChrome>((set, get) => ({
  margin: 'outline',
  chosen: false,
  openMargin: (id) => set({ margin: id, chosen: true, focusRequest: get().focusRequest + 1 }),
  closeMargin: () => set({ margin: null, chosen: true }),
  toggleMargin: (id, shown) => (shown ? get().closeMargin() : get().openMargin(id)),
  mode: 'page',
  setMode: (mode) => set({ mode }),
  focusRequest: 0,
}));

/** Whether the margin shows `id` on screen: resting outlines show only where they fit. */
export function marginShown(
  chrome: Pick<PageChrome, 'margin' | 'chosen'>,
  id: MarginId,
  docked: boolean,
): boolean {
  if (chrome.margin !== id) return false;
  return id !== 'outline' || docked || chrome.chosen;
}

/** What the slots in slots.ts are drawn with. */
export function useSlotProps(): PageSlotProps {
  const { page, editable, editor } = usePageScreen();
  const margin = usePageChrome((state) => state.margin);
  const openMargin = usePageChrome((state) => state.openMargin);
  return { page, editable, editor, margin, openMargin };
}

interface PageTyping {
  /** True from a keystroke in the body until the pointer moves, Esc, or the body loses focus. */
  typing: boolean;
  setTyping: (typing: boolean) => void;
}

/**
 * Whether the person is writing, so the chrome around the body can step back (the Docs
 * review's Writing tab: "the header fades while you type"). The header and the margin read it
 * through FADE_WHILE_TYPING; nothing jumps, since only opacity changes.
 */
export const usePageTyping = create<PageTyping>((set) => ({
  typing: false,
  setTyping: (typing) => set((state) => (state.typing === typing ? state : { typing })),
}));

/** The attribute on <html> that FADE_WHILE_TYPING keys off, set while typing. */
export const TYPING_ATTRIBUTE = 'data-doc-typing';

/**
 * The CSS hook for chrome that fades while typing: the header, the outline and the panel. It
 * fades out in 300ms and comes back in 150ms on pointer move or Esc; with reduced motion it
 * switches at once. Focus inside it shows it again, so it stays reachable from the keyboard.
 */
export const FADE_WHILE_TYPING =
  'motion-safe:transition-opacity motion-safe:duration-150 [:root[data-doc-typing]_&]:opacity-0 [:root[data-doc-typing]_&]:motion-safe:duration-300 [:root[data-doc-typing]_&:focus-within]:opacity-100';

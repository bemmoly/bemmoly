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

/** The built-in first tab of the side panel. */
export const ABOUT_PANEL = 'about';

/** What the parts of the page screen share: the page, its live body and the panel. */
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
  /** True when the outline has room for its own rail beside the body; else the panel shows it. */
  outlineInRail: boolean;
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
  /** The side panel's tab, or null while it is closed. */
  panel: string | null;
  openPanel: (id: string) => void;
  closePanel: () => void;
  /** Opens the panel on `id`, or closes it when it already shows `id`. */
  togglePanel: (id: string) => void;
}

const WIDE = '(min-width: 1280px)';
const wide = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(WIDE).matches);

/**
 * The side panel, kept across pages so the panel stays where the person left it
 * while they move through a space. It starts open where the mock's 340px panel fits beside
 * the body, and closed below that, where it opens over the body instead.
 */
export const usePageChrome = create<PageChrome>((set, get) => ({
  panel: wide() ? ABOUT_PANEL : null,
  openPanel: (id) => set({ panel: id }),
  closePanel: () => set({ panel: null }),
  togglePanel: (id) => set({ panel: get().panel === id ? null : id }),
}));

/** What the slots in slots.ts are drawn with. */
export function useSlotProps(): PageSlotProps {
  const { page, editable, editor } = usePageScreen();
  const openPanel = usePageChrome((state) => state.openPanel);
  return { page, editable, editor, openPanel };
}

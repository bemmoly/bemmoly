import type { CommentAnchor } from '@bemmoly/module-docs/shared';
import { create } from 'zustand';

/*
 * What the doc and the comments rail share while a page is open: the comment being started
 * from a selection (its anchor), and the thread in focus, whose text is highlighted harder
 * and whose card is tinted. Client state only; the threads themselves are server state.
 */

export type FocusSource = 'rail' | 'page';

interface CommentUiState {
  pageId: string | null;
  draft: CommentAnchor | null;
  active: string | null;
  /** Bumped on every "focus this thread", so the same thread can be scrolled to twice. */
  focusTick: number;
  /** Where the focus came from: the rail scrolls the page to the text, the page the rail to the card. */
  focusFrom: FocusSource;
  startDraft: (pageId: string, anchor: CommentAnchor) => void;
  clearDraft: () => void;
  focusThread: (pageId: string, id: string | null, from?: FocusSource) => void;
  reset: (pageId: string) => void;
  /** Inline threads in the order their text appears in the page. */
  order: readonly string[];
  setOrder: (pageId: string, order: readonly string[]) => void;
}

export const useCommentUi = create<CommentUiState>((set) => ({
  pageId: null,
  draft: null,
  active: null,
  focusTick: 0,
  focusFrom: 'rail',
  startDraft: (pageId, anchor) => set({ pageId, draft: anchor, active: null }),
  clearDraft: () => set({ draft: null }),
  focusThread: (pageId, id, from = 'rail') =>
    set((state) => ({ pageId, active: id, focusFrom: from, focusTick: state.focusTick + 1 })),
  reset: (pageId) => set({ pageId, draft: null, active: null, order: [] }),
  order: [],
  setOrder: (pageId, order) =>
    set((state) =>
      state.pageId === pageId && state.order.join() === order.join() ? state : { pageId, order },
    ),
}));

/** The draft and the focused thread, only when they belong to this page. */
export function usePageCommentUi(pageId: string) {
  const state = useCommentUi();
  const mine = state.pageId === pageId;
  return {
    draft: mine ? state.draft : null,
    active: mine ? state.active : null,
    focusTick: state.focusTick,
    focusFrom: state.focusFrom,
    order: mine ? state.order : [],
    startDraft: (anchor: CommentAnchor) => state.startDraft(pageId, anchor),
    clearDraft: state.clearDraft,
    focusThread: (id: string | null, from?: FocusSource) => state.focusThread(pageId, id, from),
    setOrder: (order: readonly string[]) => state.setOrder(pageId, order),
  };
}

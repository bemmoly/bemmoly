import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { locateAnchor, type TextRange } from './anchor.ts';
import {
  installHighlights,
  scrollToRange,
  setHighlights,
  type HighlightRange,
  type PageEditor,
} from './highlights.ts';
import type { CommentThread } from './use-comments.ts';

/** Edits come in bursts; the highlights are placed again once a burst settles. */
const SETTLE_MS = 250;

/**
 * Keeps the page's highlights in step with its open inline threads: installs the plugin on
 * the live editor, places each thread's text (positions first, then its words), places them
 * again after edits, marks the focused one and scrolls it into view when it is focused.
 * Returns where each thread sits, in document order, for the rail to sort by.
 */
export function useCommentHighlights(
  editor: PageEditor | null,
  threads: readonly CommentThread[],
  active: string | null,
  focusTick: number,
  /** Scroll the page to the focused text; off when the focus came from a click in the page. */
  scrollPage: boolean,
  onPick: (id: string) => void,
): ReadonlyMap<string, TextRange> {
  const [ranges, setRanges] = useState<ReadonlyMap<string, TextRange>>(new Map());
  const pick = useRef(onPick);
  useLayoutEffect(() => {
    pick.current = onPick;
  });

  useEffect(() => {
    if (!editor) return undefined;
    return installHighlights(editor, (id) => pick.current(id));
  }, [editor]);

  useEffect(() => {
    if (!editor) return undefined;
    const anchored = threads.filter((thread) => thread.root.anchor && !thread.root.resolvedAt);
    const place = () => {
      if (editor.isDestroyed) return;
      const next = new Map<string, TextRange>();
      for (const { root } of anchored) {
        const range = locateAnchor(editor.state, root.anchor!);
        if (range) next.set(root.id, range);
      }
      const list: HighlightRange[] = [...next].map(([id, range]) => ({ id, ...range }));
      setHighlights(editor, { ranges: list });
      setRanges(next);
    };
    place();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onUpdate = () => {
      clearTimeout(timer);
      timer = setTimeout(place, SETTLE_MS);
    };
    editor.on('update', onUpdate);
    return () => {
      clearTimeout(timer);
      editor.off('update', onUpdate);
    };
  }, [editor, threads]);

  useEffect(() => {
    if (editor) setHighlights(editor, { active });
  }, [editor, active]);

  // Scroll only when a thread is focused from the rail, not when its range moves.
  const latestRanges = useRef(ranges);
  useLayoutEffect(() => {
    latestRanges.current = ranges;
  });
  useEffect(() => {
    if (!editor || !active || !scrollPage) return;
    const range = latestRanges.current.get(active);
    if (range) scrollToRange(editor, range);
  }, [editor, active, focusTick, scrollPage]);

  return ranges;
}

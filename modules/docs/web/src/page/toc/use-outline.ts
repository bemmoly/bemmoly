import { headingIds } from '@bemmoly/editor';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { PageEditor } from '../screen-context.ts';

export interface OutlineEntry {
  /** The anchor the heading carries in the read-only view and in exports. */
  id: string;
  text: string;
  level: number;
  /** Where the heading starts in the live document. */
  pos: number;
}

const MAX_LEVEL = 3;
const SETTLE_MS = 150;

/** The top-level headings of the live document, with the anchors the view would print. */
export function readOutline(editor: PageEditor): OutlineEntry[] {
  const headings: { text: string; level: number; pos: number }[] = [];
  editor.state.doc.forEach((node, offset) => {
    if (node.type.name !== 'heading') return;
    headings.push({
      text: node.textContent.trim(),
      level: Number(node.attrs['level'] ?? 1),
      pos: offset,
    });
  });
  const ids = headingIds({
    type: 'doc',
    content: headings.map((heading) => ({
      type: 'heading',
      content: heading.text ? [{ type: 'text', text: heading.text }] : [],
    })),
  });
  return headings.flatMap((heading, index) =>
    heading.level <= MAX_LEVEL && heading.text ? [{ ...heading, id: ids[index]! }] : [],
  );
}

const same = (a: readonly OutlineEntry[], b: readonly OutlineEntry[]) =>
  a.length === b.length &&
  a.every((entry, index) => {
    const other = b[index]!;
    return entry.id === other.id && entry.level === other.level && entry.pos === other.pos;
  });

/**
 * The page's outline, following the document as anyone edits it: a remote edit updates it as
 * a local one does, a moment after the typing settles.
 */
export function useOutline(editor: PageEditor | null): OutlineEntry[] {
  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  useEffect(() => {
    if (!editor) {
      setOutline([]);
      return undefined;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () =>
      setOutline((current) => {
        const next = readOutline(editor);
        return same(current, next) ? current : next;
      });
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(read, SETTLE_MS);
    };
    read();
    editor.on('update', later);
    return () => {
      clearTimeout(timer);
      editor.off('update', later);
    };
  }, [editor]);
  return outline;
}

/** The heading's element in the editor, if it is drawn. */
export function headingElement(editor: PageEditor, entry: OutlineEntry): HTMLElement | null {
  const dom = editor.view.nodeDOM(entry.pos);
  return dom instanceof HTMLElement ? dom : null;
}

/** How far below the scroller's top a heading counts as the one being read. */
const READING_LINE = 96;

export interface ActiveHeading {
  active: string | null;
  /**
   * Marks a heading as the one being read after a jump to it, even when the page cannot
   * scroll it up to the line (the last sections of a short page); the person's next scroll
   * hands the choice back to the scroll position.
   */
  pin: (id: string) => void;
}

const USER_INPUT = ['wheel', 'touchmove', 'keydown', 'pointerdown'] as const;

/**
 * The heading being read: the last one whose top has passed a line near the top of the
 * scroller, updated once a frame while it scrolls. The first heading until any has passed,
 * and the last once the page is scrolled to its end.
 */
export function useActiveHeading(
  scroller: RefObject<HTMLElement | null>,
  editor: PageEditor | null,
  outline: readonly OutlineEntry[],
): ActiveHeading {
  const [active, setActive] = useState<string | null>(null);
  const pinned = useRef<string | null>(null);
  useEffect(() => {
    const root = scroller.current;
    if (!root || !editor || outline.length === 0) {
      setActive(null);
      return undefined;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (pinned.current) {
        setActive(pinned.current);
        return;
      }
      const line = root.getBoundingClientRect().top + READING_LINE;
      let current = outline[0]!.id;
      for (const entry of outline) {
        const element = headingElement(editor, entry);
        if (element && element.getBoundingClientRect().top <= line) current = entry.id;
      }
      if (root.scrollTop > 0 && root.scrollTop + root.clientHeight >= root.scrollHeight - 4) {
        current = outline.at(-1)!.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const release = () => {
      pinned.current = null;
    };
    measure();
    root.addEventListener('scroll', onScroll, { passive: true });
    for (const name of USER_INPUT) root.addEventListener(name, release, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener('scroll', onScroll);
      for (const name of USER_INPUT) root.removeEventListener(name, release);
    };
  }, [scroller, editor, outline]);
  const pin = useCallback((id: string) => {
    pinned.current = id;
    setActive(id);
  }, []);
  return { active, pin };
}

/** Scrolls a heading to the top of the reading area and puts its anchor in the address. */
export function goToHeading(editor: PageEditor, entry: OutlineEntry): void {
  const element = headingElement(editor, entry);
  if (!element) return;
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  element.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  window.history.replaceState(window.history.state, '', `#${entry.id}`);
}

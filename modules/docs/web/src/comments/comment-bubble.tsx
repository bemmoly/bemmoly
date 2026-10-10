import { useToast } from '@bemmoly/ui';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CommentAnchor } from '@bemmoly/module-docs/shared';
import { captureAnchor } from './anchor.ts';
import { cx } from './cx.ts';
import type { PageEditor } from './highlights.ts';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);
export const COMMENT_SHORTCUT = IS_MAC ? '⌘⌥M' : 'Ctrl+Alt+M';

/** 8px clear of the selection and of the viewport edge. */
const GAP = 8;

const REASONS = {
  empty: 'Select some text to comment on.',
  'too-long': 'That selection is too long to quote; select at most 2,000 characters.',
  'not-shared': 'Comments open once the page has connected.',
} as const;

function hasText(editor: PageEditor): boolean {
  const { empty, from, to } = editor.state.selection;
  return !empty && editor.state.doc.textBetween(from, to, ' ').trim().length > 0;
}

export interface CommentBubbleProps {
  editor: PageEditor | null;
  /** A comment was started from the selection: open the rail on its draft. */
  onStart: (anchor: CommentAnchor) => void;
  /** Readers may not comment: no bubble and no shortcut. */
  disabled?: boolean;
}

/**
 * "Comment" over a text selection, and ⌘⌥M (Ctrl+Alt+M) in the page for the same. Built from
 * the menu surface (8px radius, br border, shadow-menu) since no mock draws it; it fades in
 * over the selection and keeps the editor's focus and selection when pressed.
 */
export function CommentBubble({ editor, onStart, disabled = false }: CommentBubbleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const toast = useToast();

  const start = useCallback(() => {
    if (!editor || disabled) return;
    const result = captureAnchor(editor.state);
    if (result.ok) {
      onStart(result.anchor);
      setShown(false);
      // Typing now belongs to the comment box, never over the selected words in the page.
      editor.view.dom.blur();
    } else {
      toast.show({ tone: 'info', title: REASONS[result.reason] });
    }
  }, [editor, disabled, onStart, toast]);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el || !editor || editor.isDestroyed) return;
    const { from, to } = editor.state.selection;
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    // Layout size, not the box mid pop-in animation, which is scaled down.
    const box = { width: el.offsetWidth, height: el.offsetHeight };
    const sameLine = Math.abs(start.top - end.top) < 4;
    const centre = sameLine ? (start.left + end.right) / 2 : start.left + box.width / 2;
    const top = start.top - box.height - GAP;
    el.style.top = `${top < GAP ? end.bottom + GAP : top}px`;
    el.style.left = `${Math.max(GAP, Math.min(centre - box.width / 2, window.innerWidth - box.width - GAP))}px`;
  }, [editor]);

  useEffect(() => {
    if (!editor || disabled) return undefined;
    const update = () => setShown(editor.isFocused && hasText(editor));
    const onBlur = ({ event }: { event: FocusEvent }) => {
      if (!ref.current?.contains(event.relatedTarget as Node | null)) setShown(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.altKey && event.code === 'KeyM') {
        event.preventDefault();
        start();
      }
    };
    editor.on('selectionUpdate', update);
    editor.on('focus', update);
    editor.on('blur', onBlur);
    const dom = editor.view.dom;
    dom.addEventListener('keydown', onKey);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('focus', update);
      editor.off('blur', onBlur);
      dom.removeEventListener('keydown', onKey);
    };
  }, [editor, disabled, start]);

  useLayoutEffect(() => {
    if (!shown) return undefined;
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [shown, place]);

  if (!shown || !editor) return null;
  return createPortal(
    <div
      ref={ref}
      className={cx(
        'fixed z-40 flex items-center rounded-card border border-br bg-sf p-0.5 shadow-menu',
        'motion-safe:animate-pop-in',
      )}
      onMouseDown={(event) => event.preventDefault()}
    >
      <button
        type="button"
        onClick={start}
        title={`Comment (${COMMENT_SHORTCUT})`}
        className="flex cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-2.5 py-1.5 font-sans text-12h font-medium text-tx2 hover:bg-bg2 hover:text-tx focus-visible:bg-ac-bg focus-visible:text-ac focus-visible:outline-0"
      >
        Comment
        <kbd className="rounded-xs border border-br3 bg-sf px-1.5 py-px font-mono text-10h font-medium text-tx4">
          {COMMENT_SHORTCUT}
        </kbd>
      </button>
    </div>,
    document.body,
  );
}

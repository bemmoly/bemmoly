import { COMMENT_EVENT, mountedDom } from '@bemmoly/editor';
import { useToast } from '@bemmoly/ui';
import { useCallback, useEffect } from 'react';
import type { CommentAnchor } from '@bemmoly/module-docs/shared';
import { captureAnchor } from './anchor.ts';
import type { PageEditor } from './highlights.ts';

export const COMMENT_SHORTCUT = 'Mod+Alt+M';

const REASONS = {
  empty: 'Select some text to comment on.',
  'too-long': 'That selection is too long to quote; select at most 2,000 characters.',
  'not-shared': 'Comments open once the page has connected.',
} as const;

export interface CommentBubbleProps {
  editor: PageEditor | null;
  /** A comment was started from the selection: open the rail on its draft. */
  onStart: (anchor: CommentAnchor) => void;
  /** Readers may not comment: no shortcut, and the editor's bubble shows no Comment. */
  disabled?: boolean;
}

/**
 * Starting a comment on the selection: the editor's selection bubble draws the Comment button
 * (and dispatches COMMENT_EVENT on the text), ⌘⌥M (Ctrl+Alt+M) does the same from the keys.
 * Typing then belongs to the comment box, never over the selected words in the page.
 */
export function CommentBubble({ editor, onStart, disabled = false }: CommentBubbleProps) {
  const toast = useToast();

  const start = useCallback(() => {
    if (!editor || disabled) return;
    const result = captureAnchor(editor.state);
    if (result.ok) {
      onStart(result.anchor);
      mountedDom(editor)?.blur();
    } else {
      toast.show({ tone: 'info', title: REASONS[result.reason] });
    }
  }, [editor, disabled, onStart, toast]);

  useEffect(() => {
    if (!editor || disabled) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.altKey && event.code === 'KeyM') {
        event.preventDefault();
        start();
      }
    };
    const dom = mountedDom(editor);
    if (!dom) return undefined;
    dom.addEventListener('keydown', onKey);
    dom.addEventListener(COMMENT_EVENT, start);
    return () => {
      dom.removeEventListener('keydown', onKey);
      dom.removeEventListener(COMMENT_EVENT, start);
    };
  }, [editor, disabled, start]);

  return null;
}

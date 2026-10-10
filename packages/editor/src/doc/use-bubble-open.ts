import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { useEffect, useState, type RefObject } from 'react';

/** Words are selected (not a node, not inside code, where marks do not apply). */
export function hasTextSelection(editor: Editor): boolean {
  const { selection, doc } = editor.state;
  if (selection.empty || selection instanceof NodeSelection) return false;
  if (selection.$from.parent.type.spec.code) return false;
  return doc.textBetween(selection.from, selection.to, ' ').trim().length > 0;
}

/** Focus is in the bubble or in a menu it opened (menus are portalled out of it). */
function focusWithBubble(bubble: HTMLElement | null): boolean {
  const active = document.activeElement;
  if (!active || active === document.body) return false;
  return Boolean(bubble?.contains(active) || active.closest('[role="menu"]'));
}

/**
 * Whether the selection bubble shows: words selected while the text or the bubble has focus,
 * and the person may format them (or comment on them), or the ⌘K field is open.
 */
export function useBubbleOpen(
  editor: Editor,
  bubble: RefObject<HTMLElement | null>,
  linking: boolean,
  comments: boolean,
): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const update = () => {
      if (editor.isDestroyed) return;
      const focused = editor.isFocused || focusWithBubble(bubble.current);
      setShown(focused && hasTextSelection(editor) && (editor.isEditable || comments));
    };
    // Focus moving into the bubble blurs the text first; read where it landed afterwards.
    const later = () => setTimeout(update, 0);
    editor.on('selectionUpdate', update);
    editor.on('focus', update);
    editor.on('blur', later);
    document.addEventListener('focusin', later);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('focus', update);
      editor.off('blur', later);
      document.removeEventListener('focusin', later);
    };
  }, [editor, bubble, comments]);
  return linking || shown;
}

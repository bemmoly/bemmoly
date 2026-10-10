import { mountedDom } from '@bemmoly/editor';
import { useEffect } from 'react';
import { TYPING_ATTRIBUTE, usePageTyping, type PageEditor } from './screen-context.ts';

/** How far the pointer must travel to count as the person reaching for the chrome. */
const NUDGE = 4;

/** Keys that write: a character, Enter, Backspace or Delete, without ⌘ or Ctrl. */
const writes = (event: KeyboardEvent) =>
  !event.metaKey &&
  !event.ctrlKey &&
  (event.key.length === 1 || ['Enter', 'Backspace', 'Delete'].includes(event.key));

/**
 * Sets the typing flag from the body's keys and clears it when the pointer moves, on Esc or
 * when the body loses focus; mirrors it onto <html> as TYPING_ATTRIBUTE for the CSS hook.
 */
export function useTypingFlag(editor: PageEditor | null) {
  const typing = usePageTyping((state) => state.typing);
  const setTyping = usePageTyping((state) => state.setTyping);

  useEffect(() => {
    const dom = mountedDom(editor);
    if (!editor || !dom) return undefined;
    let origin: { x: number; y: number } | null = null;
    const onKey = (event: KeyboardEvent) => {
      if (writes(event) && editor.isEditable) {
        origin = null;
        setTyping(true);
      }
    };
    const onMove = (event: PointerEvent) => {
      if (!usePageTyping.getState().typing) return;
      origin ??= { x: event.clientX, y: event.clientY };
      if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > NUDGE) setTyping(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTyping(false);
    };
    const onBlur = () => setTyping(false);
    dom.addEventListener('keydown', onKey);
    dom.addEventListener('blur', onBlur);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('keydown', onEscape);
    return () => {
      dom.removeEventListener('keydown', onKey);
      dom.removeEventListener('blur', onBlur);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('keydown', onEscape);
      setTyping(false);
    };
  }, [editor, setTyping]);

  useEffect(() => {
    const root = document.documentElement;
    if (typing) root.setAttribute(TYPING_ATTRIBUTE, '');
    else root.removeAttribute(TYPING_ATTRIBUTE);
    return () => root.removeAttribute(TYPING_ATTRIBUTE);
  }, [typing]);
}

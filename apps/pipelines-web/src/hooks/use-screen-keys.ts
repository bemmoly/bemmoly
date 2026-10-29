import { typingInField } from '@bemmoly/core-web';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { focusOwnsKey } from '../lib/screen-keys.ts';

/**
 * A screen's own single keys ("j", "/", "shift+r", "[", "enter"). The shell's keys ignore
 * Shift, so a screen that needs Shift+R and R apart binds here. Like the shell's, they never
 * fire while typing, inside a dialog or menu, with Alt, Ctrl or Cmd held, or after another
 * handler took the event; and Enter or Space on a focused button, link or control presses
 * that control instead.
 */
export function useScreenKeys(bindings: Readonly<Record<string, (event: KeyboardEvent) => void>>) {
  const latest = useRef(bindings);
  useLayoutEffect(() => {
    latest.current = bindings;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.altKey || event.metaKey || event.ctrlKey) return;
      if (typingInField(event.target)) return;
      if (document.querySelector('dialog[open], [role="menu"]')) return;
      const key = event.key.toLowerCase();
      if (focusOwnsKey(event.target, key)) return;
      const name = event.shiftKey && key !== '?' ? `shift+${key}` : key;
      const run = latest.current[name];
      if (!run) return;
      event.preventDefault();
      run(event);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

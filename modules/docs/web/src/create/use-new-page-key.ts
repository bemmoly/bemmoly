import { useEffect, useRef } from 'react';

/** True while the person is typing or a dialog is open, when single keys must not act. */
export function busyTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]') ||
    document.querySelector('dialog[open]'),
  );
}

/** N makes a new page where the screen says, unless the person is typing. */
export function useNewPageKey(create: (() => void) | null) {
  const latest = useRef(create);
  latest.current = create;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.repeat || busyTarget(event.target) || !latest.current) return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

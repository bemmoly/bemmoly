import { useGlobalKeys } from '@bemmoly/core-web';
import { useRef, type KeyboardEvent } from 'react';

/** The attribute that marks a list row the keys walk. */
export const ROW_KEY = 'data-row';

const ARROWS: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

/**
 * j k walk a list's rows, which are links, so Enter opens the focused one; from anywhere on the
 * page the first j steps into the list. The arrows walk it too once a row has focus, and are
 * otherwise left to the page (scrolling) and to other controls.
 */
export function useRowKeys() {
  const list = useRef<HTMLElement>(null);
  const move = (by: number) => {
    const rows = [...(list.current?.querySelectorAll<HTMLElement>(`[${ROW_KEY}]`) ?? [])];
    if (rows.length === 0) return;
    const at = rows.indexOf(document.activeElement as HTMLElement);
    const next = at === -1 ? (by > 0 ? 0 : rows.length - 1) : at + by;
    rows[Math.min(rows.length - 1, Math.max(0, next))]?.focus();
  };
  useGlobalKeys({ j: () => move(1), k: () => move(-1) });
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const by = ARROWS[event.key];
    if (!by || !(event.target as HTMLElement).hasAttribute(ROW_KEY)) return;
    event.preventDefault();
    move(by);
  };
  return { list, onKeyDown };
}

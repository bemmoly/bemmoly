import { useCallback, useEffect, useRef } from 'react';
import { setSearchParams, useSearchParam } from './url-state.ts';

/*
 * The issue peek of a list screen (Board, Backlog): the open issue is `?issue=KEY`, so Back
 * closes it, Forward opens it again and a reload restores it. ↑↓ and j k step through the
 * issues in screen order, and closing returns focus to the card or row that opened it.
 */

/** The element showing an issue on a list screen; peek returns focus to it on close. */
export const issueElement = (key: string) =>
  document.querySelector<HTMLElement>(`[data-issue-key="${CSS.escape(key)}"]`);

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export function useIssuePeek(order: () => readonly string[]) {
  const issueKey = useSearchParam('issue');
  const opener = useRef<HTMLElement | null>(null);
  const live = useRef(order);
  useEffect(() => {
    live.current = order;
  });

  const open = useCallback((key: string) => {
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body)
      opener.current = document.activeElement;
    const current = new URLSearchParams(window.location.search).get('issue');
    // Opening from the list adds one entry; stepping between issues replaces it.
    setSearchParams({ issue: key }, { push: current === null });
  }, []);

  const close = useCallback(() => {
    const key = new URLSearchParams(window.location.search).get('issue');
    setSearchParams({ issue: null });
    const back = (key ? issueElement(key) : null) ?? opener.current;
    opener.current = null;
    requestAnimationFrame(() => back?.focus({ preventScroll: false }));
  }, []);

  const step = useCallback((by: 1 | -1) => {
    const keys = live.current();
    const key = new URLSearchParams(window.location.search).get('issue');
    if (!key) return;
    const next = keys[keys.indexOf(key) + by];
    if (!next) return;
    setSearchParams({ issue: next });
    issueElement(next)?.scrollIntoView({ block: 'nearest' });
  }, []);

  const index = issueKey ? order().indexOf(issueKey) : -1;
  const count = order().length;

  // While the peek is open, ↑↓ and j k step through the list unless the person is typing.
  useEffect(() => {
    if (!issueKey) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (typing(event.target)) return;
      const by = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 }[event.key] as 1 | -1 | undefined;
      if (!by) return;
      // A focused row or card moves itself with the arrows; the peek follows its focus.
      const onItem = (event.target as HTMLElement | null)?.closest?.('[data-issue-key]');
      if (onItem && event.key.startsWith('Arrow')) return;
      event.preventDefault();
      step(by);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [issueKey, step]);

  return {
    issueKey,
    open,
    close,
    previous: index > 0 ? () => step(-1) : undefined,
    next: index >= 0 && index < count - 1 ? () => step(1) : undefined,
  };
}

export type IssuePeek = ReturnType<typeof useIssuePeek>;

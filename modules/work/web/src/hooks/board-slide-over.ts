import { useCallback, useState } from 'react';

/*
 * Which issue the board shows in its slide-over. Opening one keeps the board in place; the
 * panel itself is the issue screens' IssueSlideOver, reached through board/board-slide-over.
 */

/** The issue page's path in the Work area, as the issue screens route it. */
export function issuePagePath(key: string): string {
  return `/work/issue/${encodeURIComponent(key)}`;
}

interface RouterState {
  __TSR_index?: number;
  [key: string]: unknown;
}

/** Moves the shell's router without a reload; its history entries carry an index and a key. */
export function navigateTo(path: string): void {
  const state = (window.history.state ?? {}) as RouterState;
  const key = Math.random().toString(36).slice(2, 10);
  window.history.pushState(
    { ...state, key, __TSR_key: key, __TSR_index: (state.__TSR_index ?? 0) + 1 },
    '',
    path,
  );
}

export function useBoardIssueSlideOver() {
  const [issueKey, setIssueKey] = useState<string | null>(null);
  const openIssue = useCallback((key: string) => setIssueKey(key), []);
  const close = useCallback(() => setIssueKey(null), []);
  const openPage = useCallback((key: string) => navigateTo(issuePagePath(key)), []);
  return { issueKey, openIssue, close, openPage };
}

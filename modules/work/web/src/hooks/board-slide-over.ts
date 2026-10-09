import { useCallback, useState } from 'react';

/*
 * Which issue the board shows in its slide-over. Opening one keeps the board in place; the
 * panel is the issue screens' IssueSlideOver, which also links to the full page.
 */
export function useBoardIssueSlideOver() {
  const [issueKey, setIssueKey] = useState<string | null>(null);
  const openIssue = useCallback((key: string) => setIssueKey(key), []);
  const close = useCallback(() => setIssueKey(null), []);
  return { issueKey, openIssue, close };
}

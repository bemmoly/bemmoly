import { useCallback, useState } from 'react';
import { DOCKED_SLIDE_OVER_QUERY, useMediaQuery } from './media-query.ts';

/*
 * Which issue the board shows in its slide-over, and how. Opening one keeps the board in place;
 * the panel is the issue screens' IssueSlideOver, which also links to the full page. On wide
 * screens it docks beside the board as in the mock; on narrower ones it overlays the board over
 * a scrim, so the board keeps its full width.
 */
export function useBoardIssueSlideOver() {
  const [issueKey, setIssueKey] = useState<string | null>(null);
  const openIssue = useCallback((key: string) => setIssueKey(key), []);
  const close = useCallback(() => setIssueKey(null), []);
  const docked = useMediaQuery(DOCKED_SLIDE_OVER_QUERY);
  const variant: 'docked' | 'overlay' = docked ? 'docked' : 'overlay';
  return { issueKey, openIssue, close, variant };
}

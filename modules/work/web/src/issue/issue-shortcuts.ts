import { useEffect } from 'react';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import type { IssueNeighbours } from './issue-list-context.ts';

/** True while a key press belongs to a field, a menu or a dialog rather than the page. */
export function ownedElsewhere(event: KeyboardEvent): boolean {
  const target = event.target;
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return true;
  if (document.querySelector('dialog[open], [role=menu], [role=listbox]')) return true;
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

const PREVIOUS = new Set(['k', 'ArrowUp']);
const NEXT = new Set(['j', 'ArrowDown']);

/**
 * ↑↓ and j k step to the previous and next issue of the list it was opened from. They do
 * nothing when that list is not known, and never while typing or inside a menu.
 */
export function useIssueShortcuts(neighbours: IssueNeighbours | null): void {
  const previous = neighbours?.previous ?? null;
  const next = neighbours?.next ?? null;
  useEffect(() => {
    if (!previous && !next) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (ownedElsewhere(event) || event.shiftKey) return;
      const to = PREVIOUS.has(event.key) ? previous : NEXT.has(event.key) ? next : null;
      if (!to) return;
      event.preventDefault();
      navigateTo(workPaths.issue(to));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [previous, next]);
}

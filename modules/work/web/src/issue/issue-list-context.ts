import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * The list an issue was opened from: the Board's cards, a backlog, My issues. The Issue page
 * and the peek step through it with ↑↓ and j k, and print "4 of 23". A list that opens an issue
 * calls `rememberIssueList` with its keys in the order it shows them; the page offers nothing
 * when the issue is not in the remembered list, as after opening a link from elsewhere.
 */
export interface IssueListContext {
  /** "Sprint 14 board", for the tooltip. */
  label: string;
  keys: readonly string[];
}

const STORAGE_KEY = 'bemmoly.work.issue-list';

function stored(): IssueListContext | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as IssueListContext;
    return Array.isArray(value.keys) ? value : null;
  } catch {
    return null;
  }
}

const useListStore = create<{ list: IssueListContext | null }>(() => ({ list: stored() }));

/** Remembers the list the next opened issue came from, for this tab, across a refresh. */
export function rememberIssueList(list: IssueListContext | null): void {
  useListStore.setState({ list });
  try {
    if (list) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be off (a private window); the list still holds for this page's life.
  }
}

/** A list keeps the remembered keys current while it is on screen. */
export function useRememberIssueList(list: IssueListContext | null): void {
  const label = list?.label ?? null;
  const signature = list ? list.keys.join('\n') : null;
  useEffect(() => {
    if (label !== null && signature !== null) {
      rememberIssueList({ label, keys: signature ? signature.split('\n') : [] });
    }
  }, [label, signature]);
}

export interface IssueNeighbours {
  label: string;
  /** 1-based. */
  position: number;
  total: number;
  previous: string | null;
  next: string | null;
}

/** Where `key` sits in the remembered list, or null when it is not in it. */
export function neighboursOf(list: IssueListContext | null, key: string): IssueNeighbours | null {
  if (!list) return null;
  const index = list.keys.indexOf(key);
  if (index < 0) return null;
  return {
    label: list.label,
    position: index + 1,
    total: list.keys.length,
    previous: list.keys[index - 1] ?? null,
    next: list.keys[index + 1] ?? null,
  };
}

export function useIssueNeighbours(key: string): IssueNeighbours | null {
  const list = useListStore((state) => state.list);
  return neighboursOf(list, key);
}

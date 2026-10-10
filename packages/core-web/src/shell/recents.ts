import { useEffect } from 'react';
import { readPreference, usePreference, writePreference } from './person-store.ts';

/** How a recent item is drawn: an issue by its type and status, anything else by an icon. */
export type RecentLook =
  | {
      kind: 'issue';
      /** The stored type, as TypeGlyph takes it. */
      type: { key: string; icon?: string | null; color?: string | null; level?: string | null };
      /** The status's category and name, as StatusGlyph places it. */
      status?: { category: 'todo' | 'in_progress' | 'done'; name: string };
    }
  | { kind: 'icon'; icon: string; moduleId?: string }
  /** A status, drawn as its glyph: "Move PLT-204 to In review". */
  | { kind: 'status'; category: 'todo' | 'in_progress' | 'done'; name: string };

/** Something the person opened: an issue, a board, a backlog, a doc page, a project. */
export interface RecentItem {
  /** Stable across visits, e.g. "work.issue:PLT-204"; a second visit moves it to the top. */
  id: string;
  title: string;
  /** A short handle printed in mono before the title, such as an issue key. */
  handle?: string;
  /** Where the item lives, e.g. "Platform Core". */
  context?: string;
  path: string;
  look: RecentLook;
  /** What the palette's type filter calls it: "Issues", "Boards", "Pages". */
  group: string;
  openedAt: string;
}

const KEY = 'recents';
const KEEP = 30;

/** Puts an item at the top of the person's recents, newest first, without duplicates. */
export function recordRecent(item: Omit<RecentItem, 'openedAt'>, now = new Date()): void {
  const list = readPreference<RecentItem[]>(KEY, []);
  const next = [
    { ...item, openedAt: now.toISOString() },
    ...list.filter((entry) => entry.id !== item.id),
  ].slice(0, KEEP);
  writePreference(KEY, next);
}

/** Drops an item that no longer opens (deleted, or access lost). */
export function forgetRecent(id: string): void {
  const list = readPreference<RecentItem[]>(KEY, []);
  if (list.some((entry) => entry.id === id)) {
    writePreference(
      KEY,
      list.filter((entry) => entry.id !== id),
    );
  }
}

/** The person's recents, newest first; Home shows four, the palette a few more. */
export function useRecents(limit = KEEP): RecentItem[] {
  const [list] = usePreference<RecentItem[]>(KEY, []);
  return list.slice(0, limit);
}

/**
 * Records a screen as opened once its data is known. Pass null while loading; the item is
 * recorded again when its title or status changes, so the palette never shows stale names.
 */
export function useRecordRecent(item: Omit<RecentItem, 'openedAt'> | null): void {
  const signature = item ? JSON.stringify(item) : null;
  useEffect(() => {
    if (signature) recordRecent(JSON.parse(signature) as Omit<RecentItem, 'openedAt'>);
  }, [signature]);
}

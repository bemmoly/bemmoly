import type { MockDb } from '../db.ts';
import { linksOf } from './work-issues.ts';
import { issueStore } from './work-issue-store.ts';
import type { Row } from './work-state.ts';

/*
 * The roadmap's dependencies as the server's loadBlocks reads them: "blocks" links between
 * items on screen, or between issues under epics on screen with each end lifted to its epic,
 * one per pair, its id the epic-level link when there is one, and whether its dates conflict.
 */

export interface MockDependency {
  id: string;
  fromId: string;
  toId: string;
  via: 'epic' | 'issue';
  links: number;
  conflict: boolean;
}

export function mockDependencies(db: MockDb, items: readonly Row[]): MockDependency[] {
  const known = new Map(items.map((item) => [item.id, item]));
  const parentOf = new Map(
    issueStore(db).issues.map((row) => [row.id, String(row['parentId'] ?? '')]),
  );
  const lift = (id: string) => {
    if (known.has(id)) return id;
    const parent = parentOf.get(id);
    return parent && known.has(parent) ? parent : null;
  };
  const pairs = new Map<string, MockDependency>();
  for (const link of linksOf(db)) {
    if (link['kind'] !== 'blocks') continue;
    const source = String(link['sourceId']);
    const target = String(link['targetId']);
    const fromId = lift(source);
    const toId = lift(target);
    if (!fromId || !toId || fromId === toId) continue;
    const direct = fromId === source && toId === target;
    const key = `${fromId}:${toId}`;
    const existing = pairs.get(key);
    if (existing) {
      existing.links += 1;
      if (direct) Object.assign(existing, { id: link.id, via: 'epic' });
      continue;
    }
    const from = known.get(fromId);
    const to = known.get(toId);
    const end = from?.['end'] ? String(from['end']) : null;
    const start = to?.['start'] ? String(to['start']) : null;
    pairs.set(key, {
      id: link.id,
      fromId,
      toId,
      via: direct ? 'epic' : 'issue',
      links: 1,
      conflict: Boolean(end && start && start < end),
    });
  }
  return [...pairs.values()];
}

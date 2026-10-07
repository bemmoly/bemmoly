import type { NotificationItem } from '@bemmoly/shared';
import { actorPhrase, verbFor } from './copy.ts';

export interface StoredNotification {
  id: string;
  userId: string;
  kind: string;
  actorId: string | null;
  actorName: string | null;
  targetKind: string;
  targetId: string;
  targetLabel: string | null;
  targetUrl: string | null;
  body: string;
  reason: string | null;
  readAt: Date | null;
  createdAt: Date;
}

function groupKey(row: StoredNotification): string {
  return [row.kind, row.targetKind, row.targetId, row.readAt ? 'read' : 'unread'].join('\u0000');
}

/**
 * Read-time grouping, so writes stay one row per event: rows of one page with
 * the same kind and target (and read state) become one entry, newest first,
 * "Aisha K. and 2 others commented on PLT-204". A group may continue on the
 * next page; it is grouped again there.
 */
export function groupNotifications(rows: readonly StoredNotification[]): NotificationItem[] {
  const groups = new Map<string, StoredNotification[]>();
  for (const row of rows) {
    const key = groupKey(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.values()].map((group) => {
    const [newest] = group as [StoredNotification, ...StoredNotification[]];
    const actors = new Map<string, { id: string | null; name: string }>();
    for (const row of group) {
      if (!row.actorName) continue;
      const key = row.actorId ?? `name:${row.actorName}`;
      if (!actors.has(key)) actors.set(key, { id: row.actorId, name: row.actorName });
    }
    const actorList = [...actors.values()];
    const verb = verbFor(newest.kind);
    const label = newest.targetLabel ?? newest.targetId;
    return {
      id: newest.id,
      ids: group.map((row) => row.id),
      kind: newest.kind,
      verb,
      summary: `${actorPhrase(actorList.map((actor) => actor.name))} ${verb} ${label}`,
      actors: actorList,
      actorCount: actorList.length,
      target: {
        kind: newest.targetKind,
        id: newest.targetId,
        label: newest.targetLabel,
        url: newest.targetUrl,
      },
      body: newest.body,
      read: newest.readAt !== null,
      createdAt: newest.createdAt.toISOString(),
    };
  });
}

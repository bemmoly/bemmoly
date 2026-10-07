import type { Notification } from '@bemmoly/shared';

export interface NotificationGroup {
  key: string;
  latest: Notification;
  ids: string[];
  actors: string[];
  unread: boolean;
}

/**
 * Groups at read time, as the tech design asks, so writes stay simple:
 * notifications with the same verb on the same target collapse into one row.
 */
export function groupNotifications(items: readonly Notification[]): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();
  for (const item of items) {
    const key = item.target ? `${item.verb}:${item.target.kind}:${item.target.id}` : item.id;
    const existing = groups.get(key);
    const actor = item.actor?.name;
    if (!existing) {
      groups.set(key, {
        key,
        latest: item,
        ids: [item.id],
        actors: actor ? [actor] : [],
        unread: item.readAt === null,
      });
      continue;
    }
    existing.ids.push(item.id);
    if (actor && !existing.actors.includes(actor)) existing.actors.push(actor);
    existing.unread ||= item.readAt === null;
  }
  return [...groups.values()];
}

/** "Aisha K.", "Aisha K. and Jonas M.", "Aisha K. and 2 others". */
export function actorLabel(actors: readonly string[]): string {
  const [first, second] = actors;
  if (!first) return 'Bemmoly';
  if (actors.length === 1) return first;
  if (actors.length === 2) return `${first} and ${second}`;
  return `${first} and ${actors.length - 1} others`;
}

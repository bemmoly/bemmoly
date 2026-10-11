import {
  realtimeClientMessageSchema,
  type PresenceEntry,
  type RealtimeServerMessage,
} from '@bemmoly/shared';
import type { MockDb } from './db.ts';
import { USER_IDS } from './seed/people.ts';

/*
 * Presence for the mock backend, so the demo shows who else is here: two teammates on every
 * board, one reading each issue, nobody on the backlog (the alone state). There is no one else
 * in the mock, so the list never changes after the join.
 */

const MINUTE = 60_000;
const READERS = [USER_IDS.priya, USER_IDS.aisha, USER_IDS.jonas];

function seeded(view: string, now: number): PresenceEntry[] {
  const at = (minutesAgo: number) => new Date(now - minutesAgo * MINUTE).toISOString();
  if (view === 'board') {
    return [
      { userId: USER_IDS.priya, view, since: at(12) },
      { userId: USER_IDS.aisha, view, since: at(4) },
    ];
  }
  if (view.startsWith('issue:')) {
    const key = view.slice('issue:'.length);
    const reader = READERS[[...key].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 3];
    return reader ? [{ userId: reader, view, since: at(2) }] : [];
  }
  return [];
}

/** The answer to a client's presence message, or null for anything else. */
export function mockPresence(
  db: MockDb,
  data: unknown,
  now = Date.now(),
): RealtimeServerMessage | null {
  const parsed = realtimeClientMessageSchema.safeParse(data);
  if (!parsed.success || parsed.data.type !== 'presence') return null;
  const { scope, view } = parsed.data;
  const people =
    scope.kind === 'project'
      ? seeded(view, now).filter((entry) => entry.userId !== db.signedInAs)
      : [];
  return { type: 'presence', scope, people };
}

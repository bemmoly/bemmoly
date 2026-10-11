import {
  PRESENCE_LIST_LIMIT,
  type PresenceEntry,
  type RealtimeScope,
  type RealtimeServerMessage,
} from '@bemmoly/shared';
import type { Logger } from '../../config/logger.ts';

/*
 * Who is where, per scope, for the sockets of this process. Presence is not
 * replicated: with more than one app process, a person connected to another
 * process does not appear. Invalidations still cross processes over NOTIFY;
 * presence would need its own channel or a shared store to do the same, which
 * one process per install (the supported shape today) does not need.
 */

/** Joins and moves one socket may make per window; a tab moves a few times a minute. */
export const PRESENCE_RATE = { max: 30, windowMs: 60_000 } as const;

interface Sender {
  send(data: string): void;
}

export interface PresenceJoin {
  socket: Sender;
  userId: string;
  scope: RealtimeScope;
  scopeKey: string;
  view: string;
}

interface Member extends PresenceJoin {
  since: Date;
}

export interface PresenceRoster {
  /** Spends one of the socket's joins; false once it is over the rate. */
  allow(owner: object): boolean;
  /** Joins a scope or moves within it, leaving any other scope, and tells everyone there. */
  join(owner: object, entry: PresenceJoin): void;
  /** Leaves, and tells whoever is left. */
  leave(owner: object): void;
  /** Forgets everyone without telling anyone, for shutdown. */
  clear(): void;
  /** Sockets present in a scope. */
  size(scopeKey: string): number;
}

export interface PresenceRosterOptions {
  logger: Logger;
  now?: () => Date;
}

/** Earliest first, one entry per person and view: two tabs on the board are one face. */
function roll(members: Iterable<Member>): Member[] {
  const first = new Map<string, Member>();
  for (const member of members) {
    const key = `${member.userId}|${member.view}`;
    const seen = first.get(key);
    if (!seen || member.since < seen.since) first.set(key, member);
  }
  return [...first.values()].sort(
    (a, b) => a.since.getTime() - b.since.getTime() || a.userId.localeCompare(b.userId),
  );
}

const entry = (member: Member): PresenceEntry => ({
  userId: member.userId,
  view: member.view,
  since: member.since.toISOString(),
});

export function createPresenceRoster(options: PresenceRosterOptions): PresenceRoster {
  const now = options.now ?? (() => new Date());
  const members = new Map<object, Member>();
  const rooms = new Map<string, Set<object>>();
  const spent = new WeakMap<object, number[]>();

  /** Each person hears everyone in the scope but themselves, on any of their sockets. */
  function tell(scopeKey: string): void {
    const room = rooms.get(scopeKey);
    if (!room) return;
    const everyone = roll([...room].flatMap((owner) => members.get(owner) ?? []));
    for (const owner of room) {
      const member = members.get(owner);
      if (!member) continue;
      const people = everyone
        .filter((other) => other.userId !== member.userId)
        .slice(0, PRESENCE_LIST_LIMIT)
        .map(entry);
      const message: RealtimeServerMessage = { type: 'presence', scope: member.scope, people };
      try {
        member.socket.send(JSON.stringify(message));
      } catch (error) {
        // The socket's close event removes it; one dead socket must not stop the others.
        options.logger.warn({ err: error }, 'a presence update did not reach a socket');
      }
    }
  }

  function remove(owner: object): string | null {
    const member = members.get(owner);
    if (!member) return null;
    members.delete(owner);
    const room = rooms.get(member.scopeKey);
    room?.delete(owner);
    if (room?.size === 0) rooms.delete(member.scopeKey);
    return member.scopeKey;
  }

  return {
    allow(owner) {
      const at = now().getTime();
      const recent = (spent.get(owner) ?? []).filter((t) => at - t < PRESENCE_RATE.windowMs);
      const ok = recent.length < PRESENCE_RATE.max;
      if (ok) recent.push(at);
      spent.set(owner, recent);
      return ok;
    },
    join(owner, next) {
      const current = members.get(owner);
      if (current && current.scopeKey === next.scopeKey && current.view === next.view) return;
      const left = current && current.scopeKey !== next.scopeKey ? remove(owner) : null;
      members.set(owner, { ...next, since: now() });
      const room = rooms.get(next.scopeKey) ?? new Set<object>();
      room.add(owner);
      rooms.set(next.scopeKey, room);
      if (left) tell(left);
      tell(next.scopeKey);
    },
    leave(owner) {
      const left = remove(owner);
      if (left) tell(left);
    },
    clear() {
      members.clear();
      rooms.clear();
    },
    size: (scopeKey) => rooms.get(scopeKey)?.size ?? 0,
  };
}

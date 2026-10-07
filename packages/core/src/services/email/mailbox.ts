import type { MailboxEntry } from '@bemmoly/shared';
import { randomUUID } from 'node:crypto';

export type CapturedEmail = Omit<MailboxEntry, 'id' | 'capturedAt'>;

/** Where the `log` sender keeps what it would have sent, newest first. */
export interface MailboxStore {
  add(email: CapturedEmail): MailboxEntry;
  list(): MailboxEntry[];
  clear(): void;
}

/**
 * Bounded and in memory: the dev mailbox is a development aid, so a restart
 * empties it, and with BEMMOLY_ROLE split the worker's captures stay in the worker.
 */
export function createMemoryMailbox(capacity = 200): MailboxStore {
  let entries: MailboxEntry[] = [];
  return {
    add(email) {
      const entry: MailboxEntry = {
        ...email,
        id: randomUUID(),
        capturedAt: new Date().toISOString(),
      };
      entries = [entry, ...entries].slice(0, capacity);
      return entry;
    },
    list: () => [...entries],
    clear() {
      entries = [];
    },
  };
}

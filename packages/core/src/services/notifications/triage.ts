import type { SqlExecutor } from '../../contracts/sql.ts';
import { setRead } from './repository.ts';

export interface EntryChange {
  userId: string;
  id: string;
  read?: boolean | undefined;
  done?: boolean | undefined;
  /** `null` ends the snooze. */
  snoozedUntil?: Date | null | undefined;
}

interface Group {
  kind: string;
  target_kind: string;
  target_id: string;
}

/** The entry's group, as `setRead` scopes it: this row and the older rows of its kind and target. */
function olderInGroup(db: SqlExecutor, input: EntryChange, group: Group) {
  return db`user_id = ${input.userId} and id <= ${input.id} and kind = ${group.kind}
    and target_kind = ${group.target_kind} and target_id = ${group.target_id}`;
}

/**
 * Undo matches the rows by the very value the forward change wrote: one
 * statement stamps a whole group with one transaction time, so comparing with
 * the entry's own stamp brings back that group and no row done or snoozed apart
 * from it.
 */
function stampedLikeEntry(
  db: SqlExecutor,
  input: EntryChange,
  group: Group,
  column: 'done_at' | 'snoozed_until',
) {
  return db`user_id = ${input.userId} and kind = ${group.kind}
    and target_kind = ${group.target_kind} and target_id = ${group.target_id}
    and ${db(column)} = (select ${db(column)} from notifications where id = ${input.id})`;
}

/**
 * Done marks read with the same stamp it writes to `done_at`, so undoing it can
 * tell the rows that were unread before (read_at = done_at) and make them
 * unread again, leaving rows read earlier as they were.
 */
async function setDone(db: SqlExecutor, input: EntryChange, group: Group): Promise<string[]> {
  const rows = input.done
    ? await db<{ id: string }[]>`
        update notifications
           set done_at = now(), read_at = coalesce(read_at, now()), updated_at = now()
         where ${olderInGroup(db, input, group)} and done_at is null
        returning id`
    : await db<{ id: string }[]>`
        update notifications
           set read_at = case when read_at = done_at then null else read_at end,
               done_at = null, updated_at = now()
         where ${stampedLikeEntry(db, input, group, 'done_at')}
        returning id`;
  return rows.map((row) => row.id);
}

/** Snoozing clears `read_at`, so the group comes back unread when the time arrives. */
async function setSnooze(
  db: SqlExecutor,
  input: EntryChange,
  group: Group,
  until: Date | null,
): Promise<string[]> {
  const rows = until
    ? await db<{ id: string }[]>`
        update notifications
           set snoozed_until = ${until.toISOString()}::timestamptz, read_at = null,
               updated_at = now()
         where ${olderInGroup(db, input, group)} and done_at is null
        returning id`
    : await db<{ id: string }[]>`
        update notifications set snoozed_until = null, updated_at = now()
         where ${stampedLikeEntry(db, input, group, 'snoozed_until')}
        returning id`;
  return rows.map((row) => row.id);
}

/**
 * Applies done, then snooze, then read to one entry of the owner's inbox, so
 * an explicit `read` in the same change always has the last word. Returns
 * every row touched, the entry first, or null when the owner has no such entry.
 */
export async function updateEntry(db: SqlExecutor, input: EntryChange): Promise<string[] | null> {
  const [group] = await db<Group[]>`
    select kind, target_kind, target_id from notifications
     where id = ${input.id} and user_id = ${input.userId}`;
  if (!group) return null;
  const touched = new Set([input.id]);
  if (input.done !== undefined) {
    for (const id of await setDone(db, input, group)) touched.add(id);
  }
  if (input.snoozedUntil !== undefined) {
    for (const id of await setSnooze(db, input, group, input.snoozedUntil)) touched.add(id);
  }
  if (input.read !== undefined) {
    const read = await setRead(db, { userId: input.userId, id: input.id, read: input.read });
    for (const id of read ?? []) touched.add(id);
  }
  return [...touched];
}

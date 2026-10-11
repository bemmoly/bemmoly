import type { NotificationChannel, NotificationView } from '@bemmoly/shared';
import type { SqlExecutor } from '../../contracts/sql.ts';
import type { StoredNotification } from './grouping.ts';

export type Delivery = Exclude<NotificationChannel, 'off'>;

export interface NewNotification {
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
  data: Record<string, unknown>;
  delivery: Delivery;
  dedupeKey: string | null;
}

interface RawNotification {
  id: string;
  user_id: string;
  kind: string;
  actor_id: string | null;
  actor_name: string | null;
  target_kind: string;
  target_id: string;
  target_label: string | null;
  target_url: string | null;
  body: string;
  reason: string | null;
  /** Strings: the pool is wrapped by Drizzle, which leaves timestamps unparsed. */
  read_at: string | null;
  done_at: string | null;
  snoozed_until: string | null;
  created_at: string;
}

const COLUMNS = `id, user_id, kind, actor_id, actor_name, target_kind, target_id, target_label,
  target_url, body, reason, read_at, done_at, snoozed_until, created_at`;

const dateOrNull = (value: string | null) => (value === null ? null : new Date(value));

function toStored(raw: RawNotification): StoredNotification {
  return {
    id: raw.id,
    userId: raw.user_id,
    kind: raw.kind,
    actorId: raw.actor_id,
    actorName: raw.actor_name,
    targetKind: raw.target_kind,
    targetId: raw.target_id,
    targetLabel: raw.target_label,
    targetUrl: raw.target_url,
    body: raw.body,
    reason: raw.reason,
    readAt: dateOrNull(raw.read_at),
    doneAt: dateOrNull(raw.done_at),
    snoozedUntil: dateOrNull(raw.snoozed_until),
    createdAt: new Date(raw.created_at),
  };
}

/** Returns the new row, or null when the dedupe key says it already exists. */
export async function insertNotification(
  db: SqlExecutor,
  row: NewNotification,
): Promise<StoredNotification | null> {
  const [inserted] = await db<RawNotification[]>`
    insert into notifications (user_id, kind, actor_id, actor_name, target_kind, target_id,
      target_label, target_url, body, reason, data, delivery, dedupe_key, emailed_at)
    values (${row.userId}, ${row.kind}, ${row.actorId}, ${row.actorName}, ${row.targetKind},
      ${row.targetId}, ${row.targetLabel}, ${row.targetUrl}, ${row.body}, ${row.reason},
      ${JSON.stringify(row.data)}::jsonb, ${row.delivery}, ${row.dedupeKey},
      ${row.delivery === 'email_immediate' ? db`now()` : null})
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning ${db.unsafe(COLUMNS)}`;
  return inserted ? toStored(inserted) : null;
}

/**
 * The rows a view shows at `now`. A snooze that has run out needs no write to
 * end: the row simply matches `inbox` again.
 */
function inView(db: SqlExecutor, view: NotificationView, now: Date) {
  const at = now.toISOString();
  if (view === 'done') return db`and done_at is not null`;
  if (view === 'snoozed') return db`and done_at is null and snoozed_until > ${at}::timestamptz`;
  return db`and done_at is null and (snoozed_until is null or snoozed_until <= ${at}::timestamptz)`;
}

/** Newest first; uuidv7 ids are time-ordered, so the id is the keyset cursor. */
export async function listNotifications(
  db: SqlExecutor,
  query: {
    userId: string;
    cursor?: string | undefined;
    limit: number;
    unreadOnly: boolean;
    view: NotificationView;
    now: Date;
  },
): Promise<{ rows: StoredNotification[]; hasMore: boolean }> {
  const rows = await db<RawNotification[]>`
    select ${db.unsafe(COLUMNS)} from notifications
     where user_id = ${query.userId}
       ${inView(db, query.view, query.now)}
       ${query.cursor ? db`and id < ${query.cursor}` : db``}
       ${query.unreadOnly ? db`and read_at is null` : db``}
     order by id desc
     limit ${query.limit + 1}`;
  return { rows: rows.slice(0, query.limit).map(toStored), hasMore: rows.length > query.limit };
}

/** The badge: unread rows in the inbox view only, so done and snoozed rows never count. */
export async function countUnread(db: SqlExecutor, userId: string, now: Date): Promise<number> {
  const [row] = await db<{ count: number }[]>`
    select count(*)::int as count from notifications
     where user_id = ${userId} and read_at is null ${inView(db, 'inbox', now)}`;
  return row?.count ?? 0;
}

/**
 * Marking an entry read marks its group: this row and the older unread rows
 * of the same kind and target. Marking unread touches only the row.
 */
export async function setRead(
  db: SqlExecutor,
  input: { userId: string; id: string; read: boolean },
): Promise<string[] | null> {
  const [row] = await db<{ kind: string; target_kind: string; target_id: string }[]>`
    select kind, target_kind, target_id from notifications
     where id = ${input.id} and user_id = ${input.userId}`;
  if (!row) return null;
  if (!input.read) {
    await db`update notifications set read_at = null, updated_at = now() where id = ${input.id}`;
    return [input.id];
  }
  const updated = await db<{ id: string }[]>`
    update notifications set read_at = now(), updated_at = now()
     where user_id = ${input.userId} and read_at is null and id <= ${input.id}
       and kind = ${row.kind} and target_kind = ${row.target_kind} and target_id = ${row.target_id}
    returning id`;
  return [input.id, ...updated.map((entry) => entry.id).filter((id) => id !== input.id)];
}

/** Leaves snoozed rows alone so they still come back unread when their snooze ends. */
export async function markAllRead(db: SqlExecutor, userId: string, now: Date): Promise<string[]> {
  const rows = await db<{ id: string }[]>`
    update notifications set read_at = now(), updated_at = now()
     where user_id = ${userId} and read_at is null ${inView(db, 'inbox', now)}
    returning id`;
  return rows.map((row) => row.id);
}

/**
 * Locks the user's unsent digest rows so two digest runs cannot both send them.
 * A row snoozed past this run waits for a later digest instead of arriving early.
 */
export async function claimDigestRows(
  db: SqlExecutor,
  userId: string,
  limit: number,
): Promise<StoredNotification[]> {
  const rows = await db<RawNotification[]>`
    select ${db.unsafe(COLUMNS)} from notifications
     where user_id = ${userId} and delivery = 'email_digest'
       and emailed_at is null and read_at is null
       and done_at is null and (snoozed_until is null or snoozed_until <= now())
     order by id desc
     limit ${limit}
     for update skip locked`;
  return rows.map(toStored);
}

export async function markEmailed(db: SqlExecutor, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await db`
    update notifications set emailed_at = now(), updated_at = now()
     where id = any(${db.array([...ids])}::uuid[])`;
}

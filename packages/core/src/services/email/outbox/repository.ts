import type { OutboxFailure, OutboxStatus } from '@bemmoly/shared';
import type { SqlExecutor } from '../../../contracts/sql.ts';

export interface NewOutboxEmail {
  kind: string;
  toAddress: string;
  toName: string | null;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
  /** Same key, same email: a second insert is ignored. */
  dedupeKey: string | null;
}

export interface OutboxRow extends NewOutboxEmail {
  id: string;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
}

interface RawOutboxRow {
  id: string;
  kind: string;
  to_address: string;
  to_name: string | null;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
  status: OutboxStatus;
  attempts: number;
  last_error: string | null;
  dedupe_key: string | null;
}

function toRow(raw: RawOutboxRow): OutboxRow {
  return {
    id: raw.id,
    kind: raw.kind,
    toAddress: raw.to_address,
    toName: raw.to_name,
    subject: raw.subject,
    html: raw.html,
    text: raw.text,
    headers: raw.headers,
    status: raw.status,
    attempts: raw.attempts,
    lastError: raw.last_error,
    dedupeKey: raw.dedupe_key,
  };
}

/**
 * Returns the row id, and whether this call created it. The pool is wrapped by
 * Drizzle (clients/postgres.ts), so JSON is bound as text and cast, and
 * timestamps are read back as strings.
 */
export async function insertOutboxEmail(
  db: SqlExecutor,
  email: NewOutboxEmail,
): Promise<{ id: string; created: boolean }> {
  const inserted = await db<{ id: string }[]>`
    insert into email_outbox (kind, to_address, to_name, subject, html, text, headers, dedupe_key)
    values (${email.kind}, ${email.toAddress}, ${email.toName}, ${email.subject}, ${email.html},
            ${email.text}, ${JSON.stringify(email.headers)}::jsonb, ${email.dedupeKey})
    on conflict (dedupe_key) where dedupe_key is not null do nothing
    returning id`;
  if (inserted[0]) return { id: inserted[0].id, created: true };
  const existing = await db<{ id: string }[]>`
    select id from email_outbox where dedupe_key = ${email.dedupeKey}`;
  return { id: existing[0]?.id ?? '', created: false };
}

/**
 * Claims due rows for sending. `sending` rows whose lease ran out (a worker
 * died mid-send) are due again; SKIP LOCKED lets several workers drain at once.
 */
export async function claimDueEmails(
  db: SqlExecutor,
  options: { limit: number; leaseSeconds: number; id?: string },
): Promise<OutboxRow[]> {
  const only = options.id ? db`and id = ${options.id}` : db``;
  const rows = await db<RawOutboxRow[]>`
    update email_outbox
       set status = 'sending',
           attempts = attempts + 1,
           next_attempt_at = now() + make_interval(secs => ${options.leaseSeconds}),
           updated_at = now()
     where id in (
       select id from email_outbox
        where status in ('pending', 'sending') and next_attempt_at <= now() ${only}
        order by next_attempt_at
        limit ${options.limit}
        for update skip locked)
    returning id, kind, to_address, to_name, subject, html, text, headers, status, attempts,
              last_error, dedupe_key`;
  return rows.map(toRow);
}

export async function markEmailSent(
  db: SqlExecutor,
  id: string,
  sent: { provider: string; messageId: string },
): Promise<void> {
  await db`
    update email_outbox
       set status = 'sent', sent_at = now(), provider = ${sent.provider},
           message_id = ${sent.messageId}, last_error = null, updated_at = now()
     where id = ${id}`;
}

export async function scheduleEmailRetry(
  db: SqlExecutor,
  id: string,
  retry: { provider: string; error: string; delaySeconds: number },
): Promise<void> {
  await db`
    update email_outbox
       set status = 'pending', provider = ${retry.provider}, last_error = ${retry.error},
           next_attempt_at = now() + make_interval(secs => ${retry.delaySeconds}),
           updated_at = now()
     where id = ${id}`;
}

export async function markEmailFailed(
  db: SqlExecutor,
  id: string,
  failure: { provider: string; error: string },
): Promise<void> {
  await db`
    update email_outbox
       set status = 'failed', provider = ${failure.provider}, last_error = ${failure.error},
           updated_at = now()
     where id = ${id}`;
}

export interface OutboxOverview {
  counts: Record<OutboxStatus, number>;
  failures: { count: number; since: Date; topReason: string | null } | null;
  recentFailures: OutboxFailure[];
}

export async function readOutboxOverview(
  db: SqlExecutor,
  options: { limit: number; failureWindowDays: number },
): Promise<OutboxOverview> {
  const counts: Record<OutboxStatus, number> = { pending: 0, sending: 0, sent: 0, failed: 0 };
  const grouped = await db<{ status: OutboxStatus; count: number }[]>`
    select status, count(*)::int as count from email_outbox group by status`;
  for (const row of grouped) counts[row.status] = row.count;

  const window = db`status = 'failed'
    and updated_at > now() - make_interval(days => ${options.failureWindowDays})`;
  const [summary] = await db<{ count: number; since: string | null; top_reason: string | null }[]>`
    select count(*)::int as count, min(updated_at) as since,
           mode() within group (order by last_error) as top_reason
      from email_outbox where ${window}`;
  const recent = await db<
    {
      id: string;
      kind: string;
      to_address: string;
      subject: string;
      attempts: number;
      last_error: string | null;
      updated_at: string;
    }[]
  >`
    select id, kind, to_address, subject, attempts, last_error, updated_at
      from email_outbox where status = 'failed'
     order by updated_at desc limit ${options.limit}`;
  return {
    counts,
    failures:
      summary && summary.count > 0 && summary.since
        ? { count: summary.count, since: new Date(summary.since), topReason: summary.top_reason }
        : null,
    recentFailures: recent.map((row) => ({
      id: row.id,
      kind: row.kind,
      to: row.to_address,
      subject: row.subject,
      attempts: row.attempts,
      lastError: row.last_error,
      failedAt: new Date(row.updated_at).toISOString(),
    })),
  };
}

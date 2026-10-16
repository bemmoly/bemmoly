import type { RequestContext, SqlClient } from '@bemmoly/core';
import type { InboxRow } from '../../models/inbox.ts';
import type { InboxEvent, InboxHandlers } from './handlers.ts';

/*
 * Processing one repository's deliveries in the order they arrived (architecture §8). A
 * session advisory lock per repository keeps two workers from interleaving one repository's
 * events; other repositories drain in parallel. A failing event is retried with the rest of
 * its repository held back, so order holds, until it has failed MAX_ATTEMPTS times; then it
 * is set aside as failed (shown on the delivery log) and the repository moves on.
 */

export const MAX_ATTEMPTS = 5;
const BATCH = 50;

export type DrainResult =
  | { status: 'drained'; processed: number; failed: number }
  | { status: 'busy' }
  | { status: 'held'; processed: number; error: string };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function drainRepository(
  sql: SqlClient,
  repository: string,
  handlers: InboxHandlers,
  ctx: RequestContext,
): Promise<DrainResult> {
  const session = await sql.reserve();
  try {
    const [lock] = await session<{ locked: boolean }[]>`
      select pg_try_advisory_lock(hashtextextended(${`pipelines.inbox:${repository}`}, 0)) as locked`;
    if (!lock?.locked) return { status: 'busy' };
    try {
      let processed = 0;
      let failed = 0;
      for (;;) {
        const rows = await sql<InboxRow[]>`
          select id, provider, delivery_id, event, repository_full_name, payload, state, attempts
          from pipeline_webhook_inbox
          where repository_full_name = ${repository} and state in ('pending', 'processing')
          order by received_at, id
          limit ${BATCH}`;
        if (rows.length === 0) return { status: 'drained', processed, failed };
        for (const row of rows) {
          const listeners = handlers.for(row.event);
          if (listeners.length === 0) {
            await sql`update pipeline_webhook_inbox set state = 'ignored', processed_at = now(),
                updated_at = now() where id = ${row.id}::uuid`;
            continue;
          }
          await sql`update pipeline_webhook_inbox set state = 'processing',
              attempts = attempts + 1, updated_at = now() where id = ${row.id}::uuid`;
          try {
            for (const handler of listeners) await handler(row.payload as InboxEvent, ctx);
            await sql`update pipeline_webhook_inbox set state = 'done', processed_at = now(),
                last_error = null, updated_at = now() where id = ${row.id}::uuid`;
            processed += 1;
          } catch (error) {
            const message = messageOf(error).slice(0, 1000);
            const spent = row.attempts + 1 >= MAX_ATTEMPTS;
            await sql`update pipeline_webhook_inbox
              set state = ${spent ? 'failed' : 'pending'}, last_error = ${message},
                processed_at = ${spent ? new Date().toISOString() : null}::timestamptz,
                updated_at = now()
              where id = ${row.id}::uuid`;
            if (!spent) return { status: 'held', processed, error: message };
            failed += 1;
          }
        }
      }
    } finally {
      await session`select pg_advisory_unlock(hashtextextended(${`pipelines.inbox:${repository}`}, 0))`;
    }
  } finally {
    session.release();
  }
}

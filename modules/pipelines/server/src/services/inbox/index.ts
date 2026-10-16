import type {
  CodeActivityResult,
  CodeEventConsumer,
  CodeEventOf,
  RequestContext,
  SendJobOptions,
} from '@bemmoly/core';
import { requireDatabase, type PipelinesServiceDeps } from '../deps.ts';
import { drainRepository, type DrainResult } from './drain.ts';
import { createInboxHandlers, type InboxHandlers } from './handlers.ts';

/*
 * The durable webhook inbox (architecture §8). The kernel verifies and claims each delivery
 * once, then hands Pipelines its events inside the webhook request; the consumer only writes
 * them to pipeline_webhook_inbox (deduplicated by delivery) and asks for a drain, so a burst
 * after an outage queues instead of timing out the host. Drains run as jobs, one repository
 * at a time, in arrival order; a sweep picks up anything a lost job left behind.
 */

export const INBOX_DRAIN_JOB = 'pipelines.inbox-drain';
export const INBOX_SWEEP_JOB = 'pipelines.inbox-sweep';

export interface InboxDeps extends PipelinesServiceDeps {
  /** Enqueues the module's own jobs; absent in tests that drain by hand. */
  sendJob?: (
    name: string,
    payload: Record<string, unknown>,
    options?: SendJobOptions,
  ) => Promise<unknown>;
}

export function createInboxService(deps: InboxDeps) {
  const handlers: InboxHandlers = createInboxHandlers();
  const sql = () => requireDatabase(deps);

  async function ingest(events: readonly CodeEventOf[]): Promise<CodeActivityResult> {
    const db = sql();
    const repositories = new Set<string>();
    let stored = 0;
    // One delivery can carry several events (an installation adding repositories), so each
    // gets its own key; a redelivery repeats the same keys and changes nothing.
    for (const [index, event] of events.entries()) {
      const rows = await db<{ id: string }[]>`
        insert into pipeline_webhook_inbox
          (provider, delivery_id, event, repository_full_name, payload)
        values (${event.hostKind}, ${`${event.deliveryId}:${index}`}, ${event.type},
          ${event.repository}, ${JSON.stringify(event)}::jsonb)
        on conflict (provider, delivery_id) do nothing
        returning id`;
      if (rows.length > 0) {
        stored += 1;
        repositories.add(event.repository);
      }
    }
    for (const repository of repositories) {
      await deps.sendJob?.(INBOX_DRAIN_JOB, { repository });
    }
    const notes = stored > 0 ? [`${stored} queued for Pipelines`] : [];
    return { linked: 0, notes };
  }

  return {
    /** Registers what happens for one event type; see InboxHandlers. */
    on: handlers.on,
    handlers,
    consumer: {
      id: 'pipelines.inbox',
      apply: (events) => ingest(events),
    } satisfies CodeEventConsumer,
    ingest,

    drain(repository: string, ctx: RequestContext): Promise<DrainResult> {
      return drainRepository(sql(), repository, handlers, ctx);
    },

    /** Repositories with work waiting longer than a minute: their drain was lost or held. */
    async waiting(): Promise<string[]> {
      const rows = await sql()<{ repository: string }[]>`
        select distinct repository_full_name as repository from pipeline_webhook_inbox
        where state in ('pending', 'processing') and repository_full_name is not null
          and updated_at < now() - interval '1 minute'
        limit 500`;
      return rows.map((row) => row.repository);
    },
  };
}

export type InboxService = ReturnType<typeof createInboxService>;
export type { InboxEvent, InboxEventType, InboxHandler } from './handlers.ts';

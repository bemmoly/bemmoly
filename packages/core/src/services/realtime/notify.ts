import { realtimeMessageSchema, ValidationError } from '@bemmoly/shared';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Logger } from '../../config/logger.ts';
import type {
  RealtimeMessage,
  RealtimePublisher,
  RealtimePublishOptions,
} from '../../contracts/realtime.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import type { RealtimeMetrics } from '../../contracts/telemetry.ts';
import { chunkRealtimeMessage } from './chunk.ts';

/** Invalidation messages for WebSocket clients and in-process caches. */
export const REALTIME_CHANNEL = 'bemmoly_events';
/**
 * Sent by the 0114 triggers when a role, membership, grant, user or API token changes;
 * every process empties its authorization cache (services/authz/shared-cache.ts).
 */
export const AUTHZ_CHANNEL = 'bemmoly_authz';
/** Domain events replicated to every process by the event bus. */
export const DOMAIN_EVENTS_CHANNEL = 'bemmoly_domain_events';
/** NOTIFY payloads must stay under 8000 bytes; leave room for the envelope. */
export const NOTIFY_LIMIT_BYTES = 7_900;

export function encodePayload(value: unknown, what: string): string {
  const json = JSON.stringify(value);
  const bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > NOTIFY_LIMIT_BYTES) {
    throw new ValidationError(`${what} is ${bytes} bytes; NOTIFY payloads must stay under 8 KB`, {
      details: { bytes, limit: NOTIFY_LIMIT_BYTES },
    });
  }
  return json;
}

/** Inside a transaction, Postgres delivers the notification only when it commits. */
export async function notify(
  executor: SqlExecutor,
  channel: string,
  payload: string,
): Promise<void> {
  await executor`select pg_notify(${channel}, ${payload})`;
}

export interface NotifyPublisherOptions {
  logger?: Logger;
  metrics?: Pick<RealtimeMetrics, 'publishFailed'>;
}

/**
 * Every mutation ends with publish({ kind, ids, projectId | spaceId | moduleId }).
 * Each process LISTENs and forwards matching messages to its WebSocket clients.
 *
 * Messages with more ids than one NOTIFY can carry go out as several. A publish inside the
 * caller's transaction throws, so the write rolls back with it; a publish without one comes
 * after the write committed, so a failure there is logged and counted, never thrown: the
 * data is saved, and failing the caller would make a job retry it and write it again.
 */
export function createNotifyPublisher(
  sql: SqlClient,
  options: NotifyPublisherOptions = {},
): RealtimePublisher {
  async function send(message: RealtimeMessage, executor: SqlExecutor): Promise<void> {
    for (const chunk of chunkRealtimeMessage(message, NOTIFY_LIMIT_BYTES)) {
      const parsed = realtimeMessageSchema.parse(chunk);
      const payload = encodePayload(parsed, `Realtime message "${message.kind}"`);
      await notify(executor, REALTIME_CHANNEL, payload);
    }
  }
  return {
    async publish(message: RealtimeMessage, publishOptions?: RealtimePublishOptions) {
      if (publishOptions?.transaction) {
        await send(message, publishOptions.transaction);
        return;
      }
      try {
        await send(message, sql);
      } catch (error) {
        options.metrics?.publishFailed(message.kind);
        options.logger?.error(
          { err: error, kind: message.kind, ids: message.ids.length },
          'realtime publish failed after commit; open screens refresh on their next fetch',
        );
      }
    },
  };
}

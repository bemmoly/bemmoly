import { realtimeMessageSchema, ValidationError } from '@bemmoly/shared';
import type { SqlClient } from '../../clients/postgres.ts';
import type {
  RealtimeMessage,
  RealtimePublisher,
  RealtimePublishOptions,
} from '../../contracts/realtime.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';

/** Invalidation messages for WebSocket clients and in-process caches. */
export const REALTIME_CHANNEL = 'bemmoly_events';
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

/**
 * Every mutation ends with publish({ kind, ids, projectId | spaceId | moduleId }).
 * Each process LISTENs and forwards matching messages to its WebSocket clients.
 */
export function createNotifyPublisher(sql: SqlClient): RealtimePublisher {
  return {
    async publish(message: RealtimeMessage, options?: RealtimePublishOptions) {
      const parsed = realtimeMessageSchema.parse(message);
      const payload = encodePayload(parsed, `Realtime message "${message.kind}"`);
      await notify(options?.transaction ?? sql, REALTIME_CHANNEL, payload);
    },
  };
}

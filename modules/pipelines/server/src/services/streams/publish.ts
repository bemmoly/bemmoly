import type { SqlClient, SqlExecutor } from '@bemmoly/core';
import {
  NOTIFY_PAYLOAD_LIMIT,
  notifyPayloadSchema,
  PIPELINES_NOTIFY_CHANNEL,
  type NotifyPayload,
} from '../../../../shared/streams.ts';

/**
 * Tells every replica's open streams that something changed. Call it with the transaction
 * that made the change: Postgres delivers a NOTIFY only when that transaction commits, so a
 * viewer never refetches before the data is there. A payload too large for NOTIFY loses its
 * data and stays an invalidation; the client refetches.
 */
export async function publishStreamEvent(sql: SqlExecutor, payload: NotifyPayload): Promise<void> {
  const parsed = notifyPayloadSchema.parse(payload);
  let text = JSON.stringify(parsed);
  if (Buffer.byteLength(text) > NOTIFY_PAYLOAD_LIMIT) {
    text = JSON.stringify({ ...parsed, data: undefined });
  }
  await sql`select pg_notify(${PIPELINES_NOTIFY_CHANNEL}, ${text})`;
}

/** LISTENs on the Pipelines channel over the pool's dedicated listener connection. */
export function listenForStreamEvents(sql: SqlClient) {
  return async (onPayload: (payload: NotifyPayload) => void) => {
    const listener = await sql.listen(PIPELINES_NOTIFY_CHANNEL, (text) => {
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return;
      }
      // Only our writers NOTIFY this channel; anything else is dropped, not trusted.
      const parsed = notifyPayloadSchema.safeParse(raw);
      if (parsed.success) onPayload(parsed.data);
    });
    return async () => {
      await listener.unlisten();
    };
  };
}

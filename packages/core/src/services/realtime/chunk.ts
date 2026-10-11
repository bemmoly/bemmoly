import type { RealtimeMessage } from '../../contracts/realtime.ts';

/** The most ids one message may carry; the shared realtime schema enforces the same cap. */
export const REALTIME_MAX_IDS = 200;

/**
 * Splits a message into messages that each fit both the id cap and the NOTIFY byte budget, so
 * an import or bulk edit of any size wakes its screens instead of failing schema validation.
 * A message with no ids, or few enough, comes back unchanged as the only element.
 */
export function chunkRealtimeMessage(
  message: RealtimeMessage,
  budgetBytes: number,
  maxIds: number = REALTIME_MAX_IDS,
): RealtimeMessage[] {
  const envelope = Buffer.byteLength(JSON.stringify({ ...message, ids: [] }), 'utf8');
  const chunks: RealtimeMessage[] = [];
  let ids: string[] = [];
  let bytes = envelope;
  for (const id of message.ids) {
    const size = Buffer.byteLength(JSON.stringify(id), 'utf8');
    // Every id after the first also costs the comma before it.
    if (ids.length > 0 && (ids.length >= maxIds || bytes + 1 + size > budgetBytes)) {
      chunks.push({ ...message, ids });
      ids = [];
      bytes = envelope;
    }
    bytes += size + (ids.length > 0 ? 1 : 0);
    ids.push(id);
  }
  if (ids.length > 0 || chunks.length === 0) chunks.push({ ...message, ids });
  return chunks;
}

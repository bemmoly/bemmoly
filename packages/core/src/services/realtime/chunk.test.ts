import { realtimeMessageSchema } from '@bemmoly/shared';
import { describe, expect, it, vi } from 'vitest';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Logger } from '../../config/logger.ts';
import { chunkRealtimeMessage, REALTIME_MAX_IDS } from './chunk.ts';
import { createNotifyPublisher, NOTIFY_LIMIT_BYTES } from './notify.ts';

const uuid = (n: number) => `0190f0e0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const ids = (count: number) => Array.from({ length: count }, (_, n) => uuid(n));

describe('chunkRealtimeMessage', () => {
  it('returns a small message unchanged, and an empty one as one message', () => {
    const message = { kind: 'docs.tree', ids: ids(3), spaceId: 's1' };
    expect(chunkRealtimeMessage(message, NOTIFY_LIMIT_BYTES)).toEqual([message]);
    expect(chunkRealtimeMessage({ kind: 'k', ids: [] }, NOTIFY_LIMIT_BYTES)).toEqual([
      { kind: 'k', ids: [] },
    ]);
  });

  it('splits 450 page ids into valid messages under the byte budget, in order', () => {
    const all = ids(450);
    const chunks = chunkRealtimeMessage(
      { kind: 'docs.tree', ids: all, spaceId: uuid(999) },
      NOTIFY_LIMIT_BYTES,
    );
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.flatMap((chunk) => chunk.ids)).toEqual(all);
    for (const chunk of chunks) {
      expect(chunk.spaceId).toBe(uuid(999));
      expect(chunk.ids.length).toBeLessThanOrEqual(REALTIME_MAX_IDS);
      expect(Buffer.byteLength(JSON.stringify(chunk))).toBeLessThanOrEqual(NOTIFY_LIMIT_BYTES);
      expect(() => realtimeMessageSchema.parse(chunk)).not.toThrow();
    }
  });

  it('caps by count when the ids are short', () => {
    const short = Array.from({ length: 401 }, (_, n) => `i${n}`);
    const sizes = chunkRealtimeMessage({ kind: 'k', ids: short }, NOTIFY_LIMIT_BYTES).map(
      (chunk) => chunk.ids.length,
    );
    expect(sizes).toEqual([200, 200, 1]);
  });
});

function fakeSql(fail = false) {
  const calls: unknown[][] = [];
  const sql = (async (_strings: TemplateStringsArray, ...values: unknown[]) => {
    if (fail) throw new Error('connection lost');
    calls.push(values);
    return [];
  }) as unknown as SqlClient;
  return { sql, calls };
}

describe('notify publisher with many ids', () => {
  it('sends one NOTIFY per chunk instead of failing validation', async () => {
    const { sql, calls } = fakeSql();
    await createNotifyPublisher(sql).publish({ kind: 'docs.tree', ids: ids(450), spaceId: 's' });
    expect(calls.length).toBeGreaterThan(2);
    const sent = calls.flatMap(([, payload]) => JSON.parse(payload as string).ids as string[]);
    expect(sent).toEqual(ids(450));
  });

  it('logs and counts a failure after commit instead of throwing', async () => {
    const { sql } = fakeSql(true);
    const publishFailed = vi.fn();
    const error = vi.fn();
    const logger = { error } as unknown as Logger;
    const publisher = createNotifyPublisher(sql, { logger, metrics: { publishFailed } });
    await expect(publisher.publish({ kind: 'docs.tree', ids: ['p1'] })).resolves.toBeUndefined();
    expect(publishFailed).toHaveBeenCalledWith('docs.tree');
    expect(error).toHaveBeenCalledOnce();
  });

  it('throws inside the caller transaction, so the write rolls back with it', async () => {
    const { sql } = fakeSql();
    const { sql: tx } = fakeSql(true);
    await expect(
      createNotifyPublisher(sql).publish({ kind: 'k', ids: ['p1'] }, { transaction: tx }),
    ).rejects.toThrow('connection lost');
  });
});

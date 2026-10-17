import { buffer } from 'node:stream/consumers';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { ModuleObjects } from '@bemmoly/core';

/*
 * Log chunks as objects: one gzip object per chunk, keyed by job, attempt and sequence, so
 * a resent chunk overwrites itself and a retried job starts a fresh set. Recently written
 * and recently read chunks stay in a small in-process cache, because a live log is read by
 * every viewer right after it is written.
 */

export type LogObjects = Pick<ModuleObjects, 'put' | 'get'>;

const CACHE_ENTRIES = 2000;

export function chunkKey(jobId: string, attempt: number, seq: number): string {
  return `logs/${jobId}/${attempt}/${seq}.json.gz`;
}

export function createChunkStore(objects: LogObjects | undefined) {
  const cache = new Map<string, string[]>();
  // Without an object store (a test, a script) chunks live only in this process.
  const memory = new Map<string, Uint8Array>();

  const remember = (key: string, lines: string[]) => {
    cache.delete(key);
    cache.set(key, lines);
    if (cache.size > CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  };

  return {
    async write(key: string, lines: string[]): Promise<number> {
      // JSON keeps empty lines and lines with stray carriage returns exactly as written.
      const body = gzipSync(Buffer.from(JSON.stringify(lines), 'utf8'));
      if (objects)
        await objects.put({ key, body, contentType: 'application/gzip', size: body.length });
      else memory.set(key, body);
      remember(key, lines);
      return body.length;
    },

    async read(key: string): Promise<string[]> {
      const cached = cache.get(key);
      if (cached) return cached;
      const stored = objects ? await buffer((await objects.get(key)).body) : memory.get(key);
      const lines = stored ? (JSON.parse(gunzipSync(stored).toString('utf8')) as string[]) : [];
      remember(key, lines);
      return lines;
    },
  };
}

export type ChunkStore = ReturnType<typeof createChunkStore>;

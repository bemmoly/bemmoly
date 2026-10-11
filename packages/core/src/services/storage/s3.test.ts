import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { buffer, text } from 'node:stream/consumers';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import type { S3Bucket, S3ObjectInfo } from '../../clients/s3-bucket.ts';
import { createS3ObjectStore } from './s3.ts';

const sha = (value: string) => createHash('sha256').update(value).digest('hex');

/** An in-memory bucket with S3's listing order and StartAfter paging. */
function fakeBucket(): S3Bucket & { objects: Map<string, { body: Buffer; type?: string }> } {
  const objects = new Map<string, { body: Buffer; type?: string }>();
  const info = (key: string): S3ObjectInfo | null => {
    const found = objects.get(key);
    return found
      ? {
          key,
          size: found.body.length,
          contentType: found.type ?? null,
          lastModified: new Date(0),
          etag: null,
        }
      : null;
  };
  return {
    objects,
    async put(key, body, options) {
      objects.set(key, {
        body: await buffer(body),
        ...(options?.contentType ? { type: options.contentType } : {}),
      });
    },
    async get(key) {
      const found = objects.get(key);
      if (!found) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
      return Readable.from([found.body]);
    },
    exists: async (key) => objects.has(key),
    head: async (key) => info(key),
    list: async (prefix) => [...objects.keys()].filter((key) => key.startsWith(prefix)).sort(),
    async listPage(prefix, options) {
      const keys = [...objects.keys()]
        .filter(
          (key) => key.startsWith(prefix) && (!options.startAfter || key > options.startAfter),
        )
        .sort();
      const items = keys.slice(0, options.limit).map((key) => info(key)!);
      return keys.length > options.limit ? { items, next: items.at(-1)!.key } : { items };
    },
    delete: async (key) => void objects.delete(key),
    deleteMany: async (keys) => keys.forEach((key) => objects.delete(key)),
    describe: (key) => `s3://test/${key}`,
  };
}

const config = {
  region: 'us-east-1',
  bucket: 'uploads',
  forcePathStyle: true,
  accessKeyId: 'k',
  secretAccessKey: 's',
  prefix: 'acme',
  timeoutMs: 1_000,
};

describe('s3 object store', () => {
  it('keeps keys under its prefix, streams back, pages a listing and deletes', async () => {
    const bucket = fakeBucket();
    const store = createS3ObjectStore(config, bucket);
    const meta = await store.put({
      key: 'attachments/a/one.txt',
      body: Readable.from(['hello ', 'world']),
      contentType: 'text/plain',
    });
    expect(meta).toMatchObject({ size: 11, checksumSha256: sha('hello world') });
    expect([...bucket.objects.keys()]).toEqual(['acme/attachments/a/one.txt']);
    const stored = await store.get('attachments/a/one.txt');
    expect(stored.metadata).toMatchObject({
      key: 'attachments/a/one.txt',
      contentType: 'text/plain',
    });
    expect(await text(stored.body)).toBe('hello world');

    await store.put({
      key: 'attachments/b.txt',
      body: new TextEncoder().encode('2'),
      contentType: 'x',
    });
    await store.put({ key: 'other/c.txt', body: new TextEncoder().encode('3'), contentType: 'x' });
    const first = await store.list('attachments/', { limit: 1 });
    expect(first.items.map((item) => item.key)).toEqual(['attachments/a/one.txt']);
    const second = await store.list('attachments/', { limit: 1, cursor: first.nextCursor! });
    expect(second).toEqual({
      items: [expect.objectContaining({ key: 'attachments/b.txt', size: 1 })],
    });

    await store.delete('attachments/b.txt');
    expect(await store.head('attachments/b.txt')).toBeNull();
    await expect(store.get('attachments/b.txt')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses bad keys, and removes an upload whose bytes do not match', async () => {
    const bucket = fakeBucket();
    const store = createS3ObjectStore({ ...config, prefix: '' }, bucket);
    await expect(
      store.put({ key: '../escape', body: new Uint8Array(), contentType: 'x' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      store.put({
        key: 'x.txt',
        body: new TextEncoder().encode('abc'),
        contentType: 'text/plain',
        checksumSha256: sha('xyz'),
      }),
    ).rejects.toThrow(/sha256/);
    await expect(
      store.put({ key: 'y.txt', body: new TextEncoder().encode('abc'), contentType: 'x', size: 4 }),
    ).rejects.toThrow(/Expected 4 bytes/);
    expect(bucket.objects.size).toBe(0);
  });
});

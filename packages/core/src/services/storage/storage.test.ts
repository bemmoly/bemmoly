import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { putContent } from './content.ts';
import { createDiskObjectStore } from './disk.ts';
import { createObjectStore } from './factory.ts';

const sha = (value: string) => createHash('sha256').update(value).digest('hex');

function store() {
  const root = mkdtempSync(join(tmpdir(), 'bemmoly-store-'));
  return { root, store: createDiskObjectStore({ root }) };
}

describe('disk object store', () => {
  it('writes atomically, streams back, lists and deletes', async () => {
    const { store: disk } = store();
    const meta = await disk.put({
      key: 'a/b/one.txt',
      body: Readable.from(['hello ', 'world']),
      contentType: 'text/plain',
    });
    expect(meta).toMatchObject({ size: 11, checksumSha256: sha('hello world') });
    const stored = await disk.get('a/b/one.txt');
    expect(await text(stored.body)).toBe('hello world');
    await disk.put({
      key: 'a/two.txt',
      body: new TextEncoder().encode('2'),
      contentType: 'text/plain',
    });
    const first = await disk.list('a/', { limit: 1 });
    expect(first.items.map((item) => item.key)).toEqual(['a/b/one.txt']);
    const second = await disk.list('a/', { limit: 1, cursor: first.nextCursor! });
    expect(second.items.map((item) => item.key)).toEqual(['a/two.txt']);
    await disk.delete('a/two.txt');
    expect(await disk.head('a/two.txt')).toBeNull();
    await expect(disk.get('a/two.txt')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects bad keys and bytes that do not match the expected checksum', async () => {
    const { store: disk } = store();
    await expect(
      disk.put({ key: '../escape', body: new Uint8Array(), contentType: 'x' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      disk.put({
        key: 'x.txt',
        body: new TextEncoder().encode('abc'),
        contentType: 'text/plain',
        checksumSha256: sha('xyz'),
      }),
    ).rejects.toThrow(/sha256/);
    expect(await disk.head('x.txt')).toBeNull();
  });
});

describe('putContent', () => {
  it('stores bytes under their sha256 and deduplicates identical uploads', async () => {
    const { root, store: disk } = store();
    const options = {
      contentType: 'text/plain',
      prefix: 'attachments',
      spoolDir: join(root, 'tmp'),
    };
    const first = await putContent(disk, new TextEncoder().encode('same'), options);
    const hash = sha('same');
    expect(first).toMatchObject({
      key: `attachments/sha256/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`,
      created: true,
      size: 4,
    });
    const again = await putContent(disk, Readable.from(['sa', 'me']), options);
    expect(again).toMatchObject({ key: first.key, created: false });
  });
});

describe('createObjectStore', () => {
  it('selects disk and reports s3 as unavailable', () => {
    expect(createObjectStore({ backend: 'disk', dataDir: tmpdir() }).id).toBe('disk');
    expect(() =>
      createObjectStore({
        backend: 's3',
        dataDir: tmpdir(),
        s3: {
          endpoint: 'http://minio',
          region: 'x',
          bucket: 'b',
          forcePathStyle: true,
          accessKeyId: 'k',
          secretAccessKey: 's',
          timeoutMs: 1000,
        },
      }),
    ).toThrow(/not available/);
  });
});

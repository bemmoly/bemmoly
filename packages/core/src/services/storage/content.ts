import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ObjectMetadata, ObjectStore } from '../../contracts/object-store.ts';
import { contentKey } from './keys.ts';

export interface PutContentOptions {
  contentType: string;
  /** Top-level namespace, e.g. "attachments". */
  prefix: string;
  /** Where the upload is spooled while it is hashed (under BEMMOLY_DATA_DIR). */
  spoolDir: string;
  signal?: AbortSignal;
}

export interface StoredContent extends ObjectMetadata {
  checksumSha256: string;
  /** False when identical bytes were already stored under the same key. */
  created: boolean;
}

/**
 * Stores bytes under their sha256, before any database row refers to them:
 * call this first, then insert the attachment row with the returned key, size
 * and sha256. A backup that dumps the database and then copies files is then
 * guaranteed to find every referenced file.
 */
export async function putContent(
  store: ObjectStore,
  body: Readable | Uint8Array,
  options: PutContentOptions,
): Promise<StoredContent> {
  await mkdir(options.spoolDir, { recursive: true });
  const spool = join(options.spoolDir, `${randomUUID()}.upload`);
  const hash = createHash('sha256');
  let size = 0;
  const measure = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      hash.update(chunk);
      size += chunk.length;
      done(null, chunk);
    },
  });
  try {
    const source = body instanceof Uint8Array ? Readable.from([body]) : body;
    await pipeline(source, measure, createWriteStream(spool), {
      ...(options.signal ? { signal: options.signal } : {}),
    });
    const checksumSha256 = hash.digest('hex');
    const key = contentKey(options.prefix, checksumSha256);
    const existing = await store.head(key);
    if (existing)
      return { ...existing, contentType: options.contentType, checksumSha256, created: false };
    const stored = await store.put(
      {
        key,
        body: createReadStream(spool),
        contentType: options.contentType,
        size,
        checksumSha256,
      },
      options.signal ? { signal: options.signal } : undefined,
    );
    return { ...stored, checksumSha256, created: true };
  } finally {
    await rm(spool, { force: true });
  }
}

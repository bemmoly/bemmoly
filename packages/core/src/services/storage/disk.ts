import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import type { ObjectMetadata, ObjectStore, PutObjectInput } from '../../contracts/object-store.ts';
import { assertObjectKey } from './keys.ts';

/** The disk store records bytes only; callers keep MIME type and size on their row. */
const UNKNOWN_TYPE = 'application/octet-stream';

export interface DiskObjectStoreConfig {
  /** BEMMOLY_DATA_DIR; objects live under <root>/objects. */
  root: string;
}

function toStream(body: Readable | Uint8Array): Readable {
  return body instanceof Uint8Array ? Readable.from([body]) : body;
}

async function walk(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.name.endsWith('.tmp') ? [] : [path];
    }),
  );
  return files.flat();
}

export function createDiskObjectStore(config: DiskObjectStoreConfig): ObjectStore {
  const objects = join(config.root, 'objects');
  const pathOf = (key: string) => join(objects, ...assertObjectKey(key).split('/'));

  async function metadata(key: string): Promise<ObjectMetadata | null> {
    try {
      const info = await stat(pathOf(key));
      return { key, size: info.size, contentType: UNKNOWN_TYPE, lastModified: info.mtime };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  return {
    id: 'disk',
    async put(input: PutObjectInput, options) {
      const target = pathOf(input.key);
      await mkdir(dirname(target), { recursive: true });
      const temporary = `${target}.${randomUUID()}.tmp`;
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
        await pipeline(toStream(input.body), measure, createWriteStream(temporary), {
          ...(options?.signal ? { signal: options.signal } : {}),
        });
        const checksumSha256 = hash.digest('hex');
        if (input.checksumSha256 && input.checksumSha256 !== checksumSha256) {
          throw new ValidationError('The stored bytes do not match the expected sha256');
        }
        if (input.size !== undefined && input.size !== size) {
          throw new ValidationError(`Expected ${input.size} bytes, received ${size}`);
        }
        // rename is atomic on one filesystem: readers see the old file or the new one.
        await rename(temporary, target);
        return {
          key: input.key,
          size,
          contentType: input.contentType,
          lastModified: new Date(),
          checksumSha256,
        };
      } finally {
        await rm(temporary, { force: true });
      }
    },
    async get(key) {
      const found = await metadata(key);
      if (!found) throw new NotFoundError(`Object "${key}" does not exist`);
      return { metadata: found, body: createReadStream(pathOf(key)) };
    },
    head: metadata,
    async delete(key) {
      await rm(pathOf(key), { force: true });
    },
    async list(prefix, options = {}) {
      const limit = Math.min(Math.max(options.limit ?? 100, 1), 1000);
      const root = prefix ? join(objects, ...prefix.replace(/\/$/, '').split('/')) : objects;
      const keys = (await walk(root))
        .map((path) => relative(objects, path).split(sep).join('/'))
        .filter((key) => key.startsWith(prefix) && (!options.cursor || key > options.cursor))
        .sort();
      const page = keys.slice(0, limit);
      const items = (await Promise.all(page.map(metadata))).filter(
        (item): item is ObjectMetadata => item !== null,
      );
      const last = page[page.length - 1];
      return keys.length > limit && last ? { items, nextCursor: last } : { items };
    },
  };
}

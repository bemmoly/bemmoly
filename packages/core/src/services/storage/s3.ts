import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import { createS3Bucket, type S3Bucket, type S3ObjectInfo } from '../../clients/s3-bucket.ts';
import type { ObjectMetadata, ObjectStore, PutObjectInput } from '../../contracts/object-store.ts';
import { assertObjectKey } from './keys.ts';

const UNKNOWN_TYPE = 'application/octet-stream';

/** An S3-compatible bucket (AWS S3, R2, MinIO, B2, GCS interop) holding the attachments. */
export interface S3ObjectStoreConfig {
  /** Empty for the provider's default endpoint; set for any other S3-compatible service. */
  endpoint?: string;
  region: string;
  bucket: string;
  /** Path-style addressing, needed by most self-hosted S3-compatible servers. */
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional key prefix inside the bucket, so one bucket can hold several installs. */
  prefix?: string;
  timeoutMs: number;
}

function normalisePrefix(prefix: string | undefined): string {
  const trimmed = (prefix ?? '').replace(/^\/+/, '');
  return trimmed === '' || trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

function toStream(body: Readable | Uint8Array): Readable {
  return body instanceof Uint8Array ? Readable.from([body]) : body;
}

/**
 * The object store on S3. Keys are validated as on disk and live under the configured
 * prefix; bytes are hashed on the way up, and an upload that does not match the expected
 * size or sha256 is deleted again and refused. The bucket client in clients/ sets the
 * timeouts on every call.
 */
export function createS3ObjectStore(
  config: S3ObjectStoreConfig,
  bucket: S3Bucket = createS3Bucket({
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    region: config.region,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    forcePathStyle: config.forcePathStyle,
    requestTimeoutMs: config.timeoutMs,
  }),
): ObjectStore {
  const root = normalisePrefix(config.prefix);
  const full = (key: string) => `${root}${assertObjectKey(key)}`;
  const local = (key: string) => key.slice(root.length);
  const toMetadata = (info: S3ObjectInfo, key: string): ObjectMetadata => ({
    key,
    size: info.size,
    contentType: info.contentType ?? UNKNOWN_TYPE,
    lastModified: info.lastModified,
    ...(info.etag ? { etag: info.etag } : {}),
  });

  async function head(key: string): Promise<ObjectMetadata | null> {
    const info = await bucket.head(full(key));
    return info ? toMetadata(info, key) : null;
  }

  return {
    id: 's3',
    async put(input: PutObjectInput) {
      const target = full(input.key);
      const hash = createHash('sha256');
      let size = 0;
      const measure = new Transform({
        transform(chunk: Buffer, _encoding, done) {
          hash.update(chunk);
          size += chunk.length;
          done(null, chunk);
        },
      });
      const source = toStream(input.body);
      source.once('error', (error) => measure.destroy(error));
      await bucket.put(target, source.pipe(measure), { contentType: input.contentType });
      const checksumSha256 = hash.digest('hex');
      const mismatch =
        input.checksumSha256 && input.checksumSha256 !== checksumSha256
          ? 'The stored bytes do not match the expected sha256'
          : input.size !== undefined && input.size !== size
            ? `Expected ${input.size} bytes, received ${size}`
            : null;
      if (mismatch) {
        await bucket.delete(target);
        throw new ValidationError(mismatch);
      }
      return {
        key: input.key,
        size,
        contentType: input.contentType,
        lastModified: new Date(),
        checksumSha256,
      };
    },
    async get(key) {
      const found = await head(key);
      if (!found) throw new NotFoundError(`Object "${key}" does not exist`);
      return { metadata: found, body: await bucket.get(full(key)) };
    },
    head,
    async delete(key) {
      await bucket.delete(full(key));
    },
    async list(prefix, options = {}) {
      const limit = Math.min(Math.max(options.limit ?? 100, 1), 1000);
      const page = await bucket.listPage(`${root}${prefix}`, {
        limit,
        ...(options.cursor ? { startAfter: full(options.cursor) } : {}),
      });
      const items = page.items.map((info) => toMetadata(info, local(info.key)));
      return page.next ? { items, nextCursor: local(page.next) } : { items };
    },
  };
}

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'node:stream';

export interface S3BucketConfig {
  /** Empty for the default endpoint; set for any S3-compatible service. */
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  requestTimeoutMs?: number;
}

export interface S3ObjectInfo {
  key: string;
  size: number;
  contentType: string | null;
  lastModified: Date;
  etag: string | null;
}

export interface S3ListPage {
  items: S3ObjectInfo[];
  /** Pass as `startAfter` for the next page; absent on the last one. */
  next?: string;
}

/**
 * The handful of bucket operations backups and the s3 object store need, without SDK
 * types leaking out.
 */
export interface S3Bucket {
  put(key: string, body: Readable, options?: { contentType?: string }): Promise<void>;
  get(key: string): Promise<Readable>;
  exists(key: string): Promise<boolean>;
  /** The object's size and type, or null when there is none at `key`. */
  head(key: string): Promise<S3ObjectInfo | null>;
  /** Every key under `prefix`, following continuation tokens. */
  list(prefix: string): Promise<string[]>;
  /** One page of keys under `prefix`, in key order, after `startAfter`. */
  listPage(prefix: string, options: { startAfter?: string; limit: number }): Promise<S3ListPage>;
  delete(key: string): Promise<void>;
  deleteMany(keys: readonly string[]): Promise<void>;
  describe(key: string): string;
}

/** A missing key, however the server words it (404 on HEAD, NoSuchKey on GET). */
export function isMissingObject(error: unknown): boolean {
  const failure = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    failure.name === 'NotFound' ||
    failure.name === 'NoSuchKey' ||
    failure.$metadata?.httpStatusCode === 404
  );
}

const DELETE_BATCH = 1_000;

export function createS3Bucket(config: S3BucketConfig): S3Bucket {
  const client = new S3Client({
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    requestHandler: {
      connectionTimeout: 10_000,
      requestTimeout: config.requestTimeoutMs ?? 120_000,
    },
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
  });
  const Bucket = config.bucket;
  async function head(key: string): Promise<S3ObjectInfo | null> {
    try {
      const found = await client.send(new HeadObjectCommand({ Bucket, Key: key }));
      return {
        key,
        size: found.ContentLength ?? 0,
        contentType: found.ContentType ?? null,
        lastModified: found.LastModified ?? new Date(0),
        etag: found.ETag ?? null,
      };
    } catch (error) {
      if (isMissingObject(error)) return null;
      throw error;
    }
  }
  return {
    async put(key, body, options) {
      const upload = new Upload({
        client,
        params: {
          Bucket,
          Key: key,
          Body: body,
          ...(options?.contentType ? { ContentType: options.contentType } : {}),
        },
      });
      await upload.done();
    },
    async get(key) {
      const result = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      if (!(result.Body instanceof Readable)) throw new Error(`Empty body for ${key}`);
      return result.Body;
    },
    exists: async (key) => (await head(key)) !== null,
    head,
    async list(prefix) {
      const keys: string[] = [];
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: token }),
        );
        for (const item of page.Contents ?? []) if (item.Key) keys.push(item.Key);
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return keys;
    },
    async listPage(prefix, options) {
      const page = await client.send(
        new ListObjectsV2Command({
          Bucket,
          Prefix: prefix,
          MaxKeys: options.limit,
          ...(options.startAfter ? { StartAfter: options.startAfter } : {}),
        }),
      );
      const items = (page.Contents ?? []).flatMap((item) =>
        item.Key
          ? [
              {
                key: item.Key,
                size: item.Size ?? 0,
                contentType: null,
                lastModified: item.LastModified ?? new Date(0),
                etag: item.ETag ?? null,
              },
            ]
          : [],
      );
      const last = items[items.length - 1];
      return page.IsTruncated && last ? { items, next: last.key } : { items };
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
    async deleteMany(keys) {
      for (let start = 0; start < keys.length; start += DELETE_BATCH) {
        const batch = keys.slice(start, start + DELETE_BATCH).map((Key) => ({ Key }));
        await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: batch } }));
      }
    },
    describe(key) {
      return `s3://${Bucket}/${key}`;
    },
  };
}

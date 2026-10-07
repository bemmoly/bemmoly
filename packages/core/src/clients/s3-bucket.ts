import {
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

/** The handful of bucket operations backups need, without SDK types leaking out. */
export interface S3Bucket {
  put(key: string, body: Readable): Promise<void>;
  get(key: string): Promise<Readable>;
  exists(key: string): Promise<boolean>;
  /** Every key under `prefix`, following continuation tokens. */
  list(prefix: string): Promise<string[]>;
  deleteMany(keys: readonly string[]): Promise<void>;
  describe(key: string): string;
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
  return {
    async put(key, body) {
      const upload = new Upload({ client, params: { Bucket, Key: key, Body: body } });
      await upload.done();
    },
    async get(key) {
      const result = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      if (!(result.Body instanceof Readable)) throw new Error(`Empty body for ${key}`);
      return result.Body;
    },
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return true;
      } catch (error) {
        if ((error as { name?: string }).name === 'NotFound') return false;
        throw error;
      }
    },
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

import { ProviderError } from '@bemmoly/shared';
import type { ObjectStore } from '../../contracts/object-store.ts';

/**
 * Configuration the S3-compatible store will take. Not implemented in 0.1.0:
 * selecting it fails at startup with a clear message. The implementation goes
 * in this file, behind the same ObjectStore interface, with an explicit
 * timeout on every call through a client in clients/.
 */
export interface S3ObjectStoreConfig {
  endpoint: string;
  region: string;
  bucket: string;
  /** Path-style addressing, needed by most self-hosted S3-compatible servers. */
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional key prefix inside the bucket. */
  prefix?: string;
  timeoutMs: number;
}

export function createS3ObjectStore(config: S3ObjectStoreConfig): ObjectStore {
  throw new ProviderError(
    `The s3 storage backend is not available in this release (bucket "${config.bucket}"); use disk`,
    { provider: 's3' },
  );
}

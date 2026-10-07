import type { Readable } from 'node:stream';

export interface ObjectMetadata {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
  etag?: string;
  checksumSha256?: string;
}

export interface PutObjectInput {
  key: string;
  body: Readable | Uint8Array;
  contentType: string;
  size?: number;
  checksumSha256?: string;
}

export interface StoredObject {
  metadata: ObjectMetadata;
  body: Readable;
}

export interface ListObjectsOptions {
  cursor?: string;
  limit?: number;
}

export interface ListObjectsResult {
  items: readonly ObjectMetadata[];
  nextCursor?: string;
}

export interface ObjectStoreCallOptions {
  signal?: AbortSignal;
}

/** Attachments and backups. One implementation per backend (disk, s3). */
export interface ObjectStore {
  readonly id: string;
  put(input: PutObjectInput, options?: ObjectStoreCallOptions): Promise<ObjectMetadata>;
  /** Throws NotFoundError when the key does not exist. */
  get(key: string, options?: ObjectStoreCallOptions): Promise<StoredObject>;
  head(key: string, options?: ObjectStoreCallOptions): Promise<ObjectMetadata | null>;
  delete(key: string, options?: ObjectStoreCallOptions): Promise<void>;
  list(
    prefix: string,
    options?: ListObjectsOptions & ObjectStoreCallOptions,
  ): Promise<ListObjectsResult>;
}

export type ObjectStoreFactory<Config> = (config: Config) => ObjectStore;

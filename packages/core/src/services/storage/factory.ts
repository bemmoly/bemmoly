import { join } from 'node:path';
import type { ObjectStore } from '../../contracts/object-store.ts';
import { createDiskObjectStore } from './disk.ts';
import { createS3ObjectStore, type S3ObjectStoreConfig } from './s3.ts';

export type StorageBackend = 'disk' | 's3';

export interface ObjectStoreSelection {
  /** The `system.storage.backend` setting. */
  backend: StorageBackend;
  /** BEMMOLY_DATA_DIR. */
  dataDir: string;
  s3?: S3ObjectStoreConfig;
}

/** One line per backend; adding one is a file plus a line here. */
const FACTORIES: Record<StorageBackend, (selection: ObjectStoreSelection) => ObjectStore> = {
  disk: (selection) => createDiskObjectStore({ root: selection.dataDir }),
  s3: (selection) => {
    if (!selection.s3) throw new TypeError('The s3 backend needs its configuration');
    return createS3ObjectStore(selection.s3);
  },
};

export function createObjectStore(selection: ObjectStoreSelection): ObjectStore {
  return FACTORIES[selection.backend](selection);
}

/** Where uploads are spooled while hashed: on the same disk as the data. */
export function spoolDirectory(dataDir: string): string {
  return join(dataDir, 'tmp');
}

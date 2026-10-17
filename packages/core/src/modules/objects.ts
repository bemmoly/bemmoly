import type {
  ListObjectsOptions,
  ListObjectsResult,
  ObjectMetadata,
  ObjectStore,
  ObjectStoreCallOptions,
  PutObjectInput,
  StoredObject,
} from '../contracts/object-store.ts';
import { ModuleLoadError } from './errors.ts';

/**
 * The install's object store as one module sees it: every key lives under
 * `modules/<id>/`, so a module can neither read nor overwrite another's objects or the
 * kernel's attachments and backups. For bytes a module owns outright (build logs, test
 * reports); files people upload go through `ctx.files` instead.
 */
export interface ModuleObjects {
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

/** `ctx.objects` for one module, bound lazily because the store is built after modules load. */
export function createModuleObjects(
  moduleId: string,
  bound: (() => ObjectStore | undefined) | undefined,
): ModuleObjects {
  const root = `modules/${moduleId}/`;
  const store = (): ObjectStore => {
    const resolved = bound?.();
    if (!resolved) {
      throw new ModuleLoadError(
        `Module "${moduleId}": object storage is not available in this process`,
        moduleId,
      );
    }
    return resolved;
  };
  const strip = (metadata: ObjectMetadata): ObjectMetadata => ({
    ...metadata,
    key: metadata.key.startsWith(root) ? metadata.key.slice(root.length) : metadata.key,
  });
  return {
    put: async (input, options) =>
      strip(await store().put({ ...input, key: root + input.key }, options)),
    async get(key, options) {
      const object = await store().get(root + key, options);
      return { ...object, metadata: strip(object.metadata) };
    },
    async head(key, options) {
      const metadata = await store().head(root + key, options);
      return metadata ? strip(metadata) : null;
    },
    delete: (key, options) => store().delete(root + key, options),
    async list(prefix, options) {
      const result = await store().list(root + prefix, options);
      return { ...result, items: result.items.map(strip) };
    },
  };
}

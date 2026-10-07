import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import type { BackupDestination } from '../destinations/types.ts';

/** An in-memory off-box destination for tests; parts are stored exactly as written. */
export function createFakeObjectStore(): BackupDestination & { objects: Map<string, Buffer> } {
  const objects = new Map<string, Buffer>();
  const key = (setName: string, file: string) => `${setName}/${file}`;
  return {
    kind: 's3',
    offBox: true,
    objects,
    async write(setName, file, body) {
      objects.set(key(setName, file), await buffer(body));
    },
    async read(setName, file) {
      const value = objects.get(key(setName, file));
      if (!value) throw new Error(`missing ${key(setName, file)}`);
      return Readable.from([value]);
    },
    async exists(setName, file) {
      return objects.has(key(setName, file));
    },
    async listSets() {
      return [...new Set([...objects.keys()].map((name) => name.split('/')[0] ?? ''))].sort();
    },
    async remove(setName) {
      for (const name of [...objects.keys()])
        if (name.startsWith(`${setName}/`)) objects.delete(name);
    },
    describe(setName) {
      return `s3://fake/${setName}/`;
    },
  };
}

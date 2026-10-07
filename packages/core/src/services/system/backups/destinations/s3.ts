import type { S3Bucket } from '../../../../clients/s3-bucket.ts';
import { isSetName } from './local.ts';
import type { BackupDestination } from './types.ts';

function normalisePrefix(prefix: string): string {
  const trimmed = prefix.replace(/^\/+/, '');
  return trimmed === '' || trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

/** <prefix><set>/<part> in any S3-compatible bucket. Parts arrive already encrypted. */
export function createS3Destination(bucket: S3Bucket, prefix: string): BackupDestination {
  const root = normalisePrefix(prefix);
  const key = (setName: string, file: string) => {
    if (!isSetName(setName)) throw new Error(`"${setName}" is not a backup set name`);
    return `${root}${setName}/${file}`;
  };
  return {
    kind: 's3',
    offBox: true,
    write: (setName, file, body) => bucket.put(key(setName, file), body),
    read: (setName, file) => bucket.get(key(setName, file)),
    exists: (setName, file) => bucket.exists(key(setName, file)),
    async listSets() {
      const sets = new Set<string>();
      for (const item of await bucket.list(root)) {
        const name = item.slice(root.length).split('/')[0] ?? '';
        if (isSetName(name)) sets.add(name);
      }
      return [...sets].sort();
    },
    async remove(setName) {
      if (!isSetName(setName)) return;
      await bucket.deleteMany(await bucket.list(`${root}${setName}/`));
    },
    describe: (setName) => bucket.describe(`${root}${setName}/`),
  };
}

import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { ObjectStore } from '../../../contracts/object-store.ts';
import { createDiskObjectStore } from '../../storage/index.ts';
import type { SystemDependencies } from '../deps.ts';
import { createDigestStream } from '../utils/hashing.ts';
import { ATTACHMENTS_ARCHIVE, ATTACHMENTS_PREFIX } from './attachments.ts';
import type { StagedPart } from './store-set.ts';

/** Objects moved at once between the store and the staging folder. */
const PARALLEL = 8;
const UNKNOWN_TYPE = 'application/octet-stream';

/** The store uploads live in: the kernel's (disk or S3), or the disk store under the data dir. */
export function attachmentStore(deps: SystemDependencies): ObjectStore {
  return deps.objectStore ?? createDiskObjectStore({ root: deps.config.dataDir });
}

async function eachLimited<T>(items: readonly T[], run: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await run(items[next++] as T);
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, worker));
}

/**
 * Copies the planned files out of the object store into the staging folder, then archives
 * them with tar. Archive paths are the keys without the attachments/ prefix, as every
 * backup's have always been, so old and new archives restore the same way.
 */
export async function stageAttachments(
  deps: SystemDependencies,
  staging: string,
  files: readonly string[],
): Promise<StagedPart | null> {
  if (files.length === 0) return null;
  const store = attachmentStore(deps);
  const root = path.join(staging, 'attachments');
  await eachLimited(files, async (file) => {
    const target = path.join(root, ...file.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    const { body } = await store.get(`${ATTACHMENTS_PREFIX}${file}`);
    await pipeline(body, createWriteStream(target, { mode: 0o640 }));
  });
  const archive = path.join(staging, ATTACHMENTS_ARCHIVE);
  const digest = createDigestStream();
  const out = createWriteStream(archive, { mode: 0o640 });
  const written = new Promise<void>((resolve, reject) => {
    out.once('finish', resolve);
    out.once('error', reject);
  });
  digest.pipe(out);
  await deps.tar.create(root, files, digest);
  await written;
  return { path: archive, name: ATTACHMENTS_ARCHIVE, digest: digest.digest() };
}

async function filesUnder(root: string, dir = root): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const found = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return filesUnder(root, full);
      return entry.isFile() ? [path.relative(root, full).split(path.sep).join('/')] : [];
    }),
  );
  return found.flat();
}

/**
 * Puts every file extracted under `root` back into the object store under attachments/.
 * Keys are content addressed, so a file already there with the same size is the same bytes
 * and is skipped. Resolves to how many objects were written.
 */
export async function importAttachments(store: ObjectStore, root: string): Promise<number> {
  const files = await filesUnder(root);
  let written = 0;
  await eachLimited(files, async (file) => {
    const key = `${ATTACHMENTS_PREFIX}${file}`;
    const source = path.join(root, ...file.split('/'));
    const { size } = await stat(source);
    if ((await store.head(key))?.size === size) return;
    await store.put({ key, body: createReadStream(source), contentType: UNKNOWN_TYPE, size });
    written += 1;
  });
  return written;
}

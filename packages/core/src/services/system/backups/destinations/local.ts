import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { BackupDestination } from './types.ts';

const SET_PATTERN = /^bemmoly-\d{8}-\d{6}-[a-z-]+-[a-f0-9]{8}$/;

export function isSetName(value: string): boolean {
  return SET_PATTERN.test(value);
}

function safeJoin(root: string, setName: string, file?: string): string {
  if (!isSetName(setName)) throw new Error(`"${setName}" is not a backup set name`);
  if (file !== undefined && (file.includes('/') || file.startsWith('.'))) {
    throw new Error(`"${file}" is not a backup part name`);
  }
  return file === undefined ? path.join(root, setName) : path.join(root, setName, file);
}

/** /var/bemmoly/backups/<set>/<part>; parts are written to a temporary name, then renamed. */
export function createLocalDestination(root: string): BackupDestination {
  return {
    kind: 'local',
    offBox: false,
    async write(setName, file, body) {
      const folder = safeJoin(root, setName);
      await mkdir(folder, { recursive: true, mode: 0o750 });
      const target = safeJoin(root, setName, file);
      const partial = `${target}.partial`;
      await pipeline(body, createWriteStream(partial, { mode: 0o640 }));
      await rename(partial, target);
    },
    async read(setName, file) {
      const target = safeJoin(root, setName, file);
      await access(target);
      return createReadStream(target);
    },
    async exists(setName, file) {
      try {
        await access(safeJoin(root, setName, file));
        return true;
      } catch {
        return false;
      }
    },
    async listSets() {
      try {
        const entries = await readdir(root, { withFileTypes: true });
        return entries
          .filter((entry) => entry.isDirectory() && isSetName(entry.name))
          .map((entry) => entry.name)
          .sort();
      } catch {
        return [];
      }
    },
    async remove(setName) {
      await rm(safeJoin(root, setName), { recursive: true, force: true });
    },
    describe(setName) {
      return path.join(root, setName);
    },
  };
}

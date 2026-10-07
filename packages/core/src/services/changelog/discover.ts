import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Changelog, Changeset } from '../../contracts/changelog.ts';
import { checksumOfSource } from './checksum.ts';
import { ChangelogError } from './errors.ts';

/** Files that look like changesets: a numeric prefix, a dash, a name, `.ts`. */
const CHANGESET_FILE = /^\d+-.+\.ts$/;

function numericPrefix(file: string): number {
  return Number.parseInt(file, 10);
}

function isChangeset(value: unknown): value is Changeset {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Changeset>;
  return typeof candidate.id === 'string' && typeof candidate.up === 'function';
}

async function listChangesetFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory);
    return entries
      .filter((file) => CHANGESET_FILE.test(file) && !file.endsWith('.test.ts'))
      .sort((a, b) => numericPrefix(a) - numericPrefix(b) || a.localeCompare(b));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * Loads one changelog folder: every `NNNN-name.ts` file, ordered by numeric
 * prefix, each default-exporting a changeset whose id matches the file name.
 * The checksum is the sha256 of the file's source. Gaps and duplicates are
 * reported by validation, not here, so `db validate` can list them all.
 */
export async function loadChangelogFolder(folder: URL | string): Promise<Changelog> {
  const directory = folder instanceof URL ? fileURLToPath(folder) : folder;
  const files = await listChangesetFiles(directory);
  const changesets: Changeset[] = [];
  for (const file of files) {
    const path = join(directory, file);
    const source = await readFile(path, 'utf8');
    const loaded = (await import(pathToFileURL(path).href)) as { default?: unknown };
    const definition = loaded.default;
    if (!isChangeset(definition)) {
      throw new ChangelogError(
        'invalid_changelog',
        `${path} must default-export changeset({ id, author, description, up })`,
      );
    }
    const expectedId = basename(file, '.ts');
    if (definition.id !== expectedId) {
      throw new ChangelogError(
        'invalid_changelog',
        `${path} declares id "${definition.id}"; the id must match the file name "${expectedId}"`,
      );
    }
    changesets.push({ ...definition, source: { file: path, checksum: checksumOfSource(source) } });
  }
  return changesets;
}

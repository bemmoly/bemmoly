import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { RepositoryTree } from '../code/repository-reader.ts';

/** A fixture repository on disk as a tree, for discovery's tests; no network. */
export async function fixtureTree(root: string, commitSha = 'fixture'): Promise<RepositoryTree> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const paths = entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort();
  return {
    commitSha,
    paths,
    read: async (path) => (paths.includes(path) ? readFile(join(root, path), 'utf8') : null),
  };
}

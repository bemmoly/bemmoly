import { glob, stat } from 'node:fs/promises';
import path from 'node:path';

/** Dependency and VCS folders are never test files, reports or artifacts a job means. */
const SKIPPED_FOLDERS = new Set(['node_modules', '.git']);

/**
 * Expands glob patterns under `cwd` into the regular files they match: relative POSIX paths,
 * sorted and without duplicates, so every shard of a job sends the same list.
 */
export async function expandGlobs(patterns: readonly string[], cwd: string): Promise<string[]> {
  if (patterns.length === 0) return [];
  const found = new Set<string>();
  const matches = glob([...patterns], {
    cwd,
    exclude: (entry: string) => SKIPPED_FOLDERS.has(path.basename(entry)),
  });
  for await (const match of matches) {
    const absolute = path.resolve(cwd, match);
    // A pattern may not reach outside the workspace with ../ and pick up the host's files.
    const relative = path.relative(cwd, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
    const info = await stat(absolute).catch(() => undefined);
    if (info?.isFile()) found.add(relative.split(path.sep).join('/'));
  }
  return [...found].sort();
}

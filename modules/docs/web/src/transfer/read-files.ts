import type { ImportFile } from '@bemmoly/module-docs/shared';
import { IMPORT_MAX_BYTES } from '@bemmoly/module-docs/shared';

/*
 * Files picked or dropped for an import, as the import body carries them: a "/" path (a
 * folder's tree becomes the page tree) and the text. Only the kinds the format reads are
 * kept; a folder picked whole loses its own name, so its files land at the top.
 */

export type ImportFormat = 'markdown' | 'confluence';

export const EXTENSIONS: Record<ImportFormat, readonly string[]> = {
  markdown: ['.md', '.markdown', '.mdown', '.txt'],
  confluence: ['.html', '.htm', '.xhtml', '.xml'],
};

/** At most this many files go in one import, as the server allows. */
export const IMPORT_MAX_FILES = 2000;

export interface PickedFile {
  path: string;
  size: number;
  file: File;
}

const extensionOf = (name: string) => name.slice(name.lastIndexOf('.')).toLowerCase();

export const accepts = (format: ImportFormat, name: string) =>
  name.lastIndexOf('.') > 0 && EXTENSIONS[format].includes(extensionOf(name));

/** The path a file was picked or dropped with: inside its folder when it came in one. */
function pathOf(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return (relative || file.name).replace(/\\/g, '/').replace(/^\/+/, '');
}

/** Drops the one folder every path starts with, so picking "export/" imports its contents. */
export function stripSharedRoot(paths: readonly string[]): string[] {
  const roots = new Set(paths.map((path) => (path.includes('/') ? path.split('/')[0] : null)));
  if (roots.size !== 1 || roots.has(null)) return [...paths];
  return paths.map((path) => path.slice(path.indexOf('/') + 1));
}

/** The files of a pick that this format reads, in path order, without duplicates. */
export function pickFiles(format: ImportFormat, files: Iterable<File>): PickedFile[] {
  const kept = [...files].filter((file) => accepts(format, file.name));
  const paths = stripSharedRoot(kept.map(pathOf));
  const byPath = new Map<string, PickedFile>();
  kept.forEach((file, index) =>
    byPath.set(paths[index]!, { path: paths[index]!, size: file.size, file }),
  );
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/** Why a pick cannot go, in plain words, or null when it can. */
export function pickProblem(files: readonly PickedFile[]): string | null {
  if (files.length === 0) return null;
  if (files.length > IMPORT_MAX_FILES) {
    return `One import takes at most ${IMPORT_MAX_FILES.toLocaleString()} files; this has ${files.length.toLocaleString()}.`;
  }
  const bytes = files.reduce((sum, file) => sum + file.size, 0);
  if (bytes > IMPORT_MAX_BYTES) return 'One import carries at most 10 MB of text. Split it in two.';
  return null;
}

/** Reads the picked files as the import body's files. */
export async function readImportFiles(files: readonly PickedFile[]): Promise<ImportFile[]> {
  return Promise.all(files.map(async ({ path, file }) => ({ path, content: await file.text() })));
}

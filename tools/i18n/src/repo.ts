import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CATALOG_FILE, parseCatalog, type SourceCatalog } from './compile.ts';

export interface CatalogFile {
  /** Relative to the repository root. */
  file: string;
  namespace: string;
  locale: string;
  messages: SourceCatalog;
}

/** Where catalogs and the code that uses them live. */
const ROOTS = ['apps', 'packages', 'modules'];
const SKIP = new Set([
  'node_modules',
  'dist',
  'dist-demo',
  'storybook-static',
  'coverage',
  'test-results',
  'playwright-report',
  '.turbo',
  '.astro',
]);

function* walk(dir: string): Generator<string> {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

export function repoFiles(root: string): string[] {
  return ROOTS.flatMap((top) => [...walk(join(root, top))]).map((path) => relative(root, path));
}

export function loadCatalogs(root: string, files = repoFiles(root)): CatalogFile[] {
  return files.flatMap((file) => {
    const match = CATALOG_FILE.exec(`/${file}`);
    if (!match) return [];
    const [, namespace = '', locale = ''] = match;
    const messages = parseCatalog(readFileSync(join(root, file), 'utf8'), file);
    return [{ file, namespace, locale, messages }];
  });
}

/** `t('shell.nav.home'`, `t.rich('…'`, `shell.t('…'`: an id written out in code. */
const USE = /\bt(?:\.rich)?\(\s*(['"])([a-z][\w-]*(?:\.[\w-]+)+)\1/g;
const CODE = /\.(ts|tsx)$/;
const TEST = /\.(test|spec|stories)\.tsx?$|[\\/](e2e|test|testing|mocks)[\\/]/;

/** Every id the product's code names, with the files that name it. Tests are left out. */
export function findUsages(root: string, files = repoFiles(root)): Map<string, string[]> {
  const usages = new Map<string, string[]>();
  for (const file of files) {
    if (!CODE.test(file) || TEST.test(file)) continue;
    const text = readFileSync(join(root, file), 'utf8');
    for (const match of text.matchAll(USE)) {
      const id = match[2] ?? '';
      usages.set(id, [...(usages.get(id) ?? []), file]);
    }
  }
  return usages;
}

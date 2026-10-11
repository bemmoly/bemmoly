import { argumentsOf, CatalogError, compileOne, ID_PATTERN } from './compile.ts';
import type { CatalogFile } from './repo.ts';

export interface CheckOptions {
  source: string;
  /** Locales offered to people; each needs every namespace complete. */
  shipped: readonly string[];
}

export interface CheckResult {
  errors: string[];
  warnings: string[];
}

const sameSet = (a: Set<string>, b: Set<string>) =>
  a.size === b.size && [...a].every((name) => b.has(name));

function checkFile(catalog: CatalogFile, errors: string[]) {
  for (const [id, message] of Object.entries(catalog.messages)) {
    if (!ID_PATTERN.test(id) || !id.startsWith(`${catalog.namespace}.`)) {
      errors.push(`${catalog.file}: ${id} must look like "${catalog.namespace}.area.name"`);
    }
    try {
      compileOne(message, `${catalog.file}: ${id}`);
    } catch (error) {
      if (!(error instanceof CatalogError)) throw error;
      errors.push(error.message);
    }
  }
}

/** A translation's placeholders must be the source's, or values would go missing. */
function checkTranslation(source: CatalogFile, translation: CatalogFile, errors: string[]) {
  for (const [id, message] of Object.entries(translation.messages)) {
    const original = source.messages[id];
    if (original === undefined) {
      errors.push(`${translation.file}: ${id} is not in ${source.file}; remove it`);
      continue;
    }
    if (message === '') continue;
    try {
      const want = argumentsOf(compileOne(original, id));
      const have = argumentsOf(compileOne(message, id));
      if (!sameSet(want, have)) {
        errors.push(
          `${translation.file}: ${id} uses {${[...have].join(', ')}}, the source {${[...want].join(', ')}}`,
        );
      }
    } catch {
      // checkFile already reported the message that does not parse.
    }
  }
}

/**
 * The catalog gate CI runs: well-formed ids and messages, one source per namespace, every
 * shipped locale complete, translations true to their source's placeholders, and every id
 * the code names present in English. Ids nothing names are warnings, since an id can be
 * built at run time (`errors.<code>`).
 */
export function checkCatalogs(
  catalogs: readonly CatalogFile[],
  usages: ReadonlyMap<string, readonly string[]>,
  { source, shipped }: CheckOptions,
): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sources = new Map<string, CatalogFile>();
  for (const catalog of catalogs) {
    checkFile(catalog, errors);
    if (catalog.locale !== source) continue;
    const other = sources.get(catalog.namespace);
    if (other) errors.push(`${catalog.file}: namespace "${catalog.namespace}" is ${other.file}'s`);
    else sources.set(catalog.namespace, catalog);
  }
  for (const catalog of catalogs) {
    if (catalog.locale === source) continue;
    const original = sources.get(catalog.namespace);
    if (!original) errors.push(`${catalog.file}: no ${source} source for "${catalog.namespace}"`);
    else checkTranslation(original, catalog, errors);
  }
  for (const locale of shipped.filter((tag) => tag !== source)) {
    for (const original of sources.values()) {
      const translation = catalogs.find(
        (catalog) => catalog.namespace === original.namespace && catalog.locale === locale,
      );
      const missing = Object.keys(original.messages).filter(
        (id) => !translation?.messages[id]?.trim(),
      );
      if (missing.length > 0) {
        errors.push(
          `${locale} ships, but "${original.namespace}" lacks ${missing.length}: ${missing.join(', ')}`,
        );
      }
    }
  }
  for (const [id, files] of usages) {
    const namespace = id.split('.')[0] ?? '';
    const original = sources.get(namespace);
    if (original && original.messages[id] === undefined) {
      errors.push(`${files.join(', ')}: ${id} is not in ${original.file}`);
    }
  }
  for (const original of sources.values()) {
    const unnamed = Object.keys(original.messages).filter((id) => !usages.has(id));
    if (unnamed.length > 0) {
      warnings.push(`${original.file}: no t() call names ${unnamed.join(', ')}`);
    }
  }
  return { errors, warnings };
}

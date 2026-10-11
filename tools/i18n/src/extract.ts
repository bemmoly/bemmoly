import { dirname, join } from 'node:path';
import type { SourceCatalog } from './compile.ts';
import type { CatalogFile } from './repo.ts';

export interface PlannedWrite {
  file: string;
  messages: SourceCatalog;
}

export interface ExtractPlan {
  writes: PlannedWrite[];
  /** Ids the code names that have no English yet: write them in the source catalog. */
  unwritten: string[];
}

const sorted = (messages: SourceCatalog): SourceCatalog =>
  Object.fromEntries(Object.entries(messages).sort(([a], [b]) => (a < b ? -1 : 1)));

export function serialise(messages: SourceCatalog): string {
  return `${JSON.stringify(sorted(messages), null, 2)}\n`;
}

/**
 * What `pnpm i18n:extract` changes: every catalog sorted by id and, with a locale, that
 * locale's catalog beside each source with every source id (new ones empty, for a translator
 * to fill; ones the source dropped removed). English is written by hand, so ids the code
 * uses without a source message are listed, never invented.
 */
export function planExtract(
  catalogs: readonly CatalogFile[],
  usages: ReadonlyMap<string, readonly string[]>,
  options: { source: string; locale?: string | undefined },
): ExtractPlan {
  const sources = catalogs.filter((catalog) => catalog.locale === options.source);
  const writes: PlannedWrite[] = catalogs
    .filter((catalog) => catalog.locale !== options.locale)
    .map((catalog) => ({ file: catalog.file, messages: sorted(catalog.messages) }));
  if (options.locale && options.locale !== options.source) {
    for (const source of sources) {
      const existing = catalogs.find(
        (catalog) => catalog.namespace === source.namespace && catalog.locale === options.locale,
      );
      const messages = Object.fromEntries(
        Object.keys(source.messages).map((id) => [id, existing?.messages[id] ?? '']),
      );
      writes.push({
        file:
          existing?.file ??
          join(dirname(source.file), `${source.namespace}.${options.locale}.json`),
        messages: sorted(messages),
      });
    }
  }
  const known = new Map(sources.map((source) => [source.namespace, source.messages]));
  const unwritten = [...usages.keys()].filter((id) => {
    const messages = known.get(id.split('.')[0] ?? '');
    return messages !== undefined && messages[id] === undefined;
  });
  return { writes, unwritten: unwritten.sort() };
}

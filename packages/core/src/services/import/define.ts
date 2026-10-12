import { importSourceSchema, type ImportSource } from '@bemmoly/shared';
import type { Importer } from '../../contracts/importer.ts';
import type { FromModule } from '../../modules/registry.ts';
import type { ImporterDefinition } from '../../modules/registries.ts';

const IMPORTER = Symbol.for('bemmoly.importer');

/** Marks an importer so the kernel can tell it from any other contribution. */
export function defineImporter<T extends Importer>(importer: T): T {
  Object.defineProperty(importer, IMPORTER, { value: true, enumerable: false });
  return importer;
}

export function isImporter(value: unknown): value is Importer {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<symbol, unknown>)[IMPORTER] === true
  );
}

/** What a module passes to ctx.importers.add. */
export function importerContribution(importer: Importer): ImporterDefinition {
  return { id: importer.id, label: importer.label, definition: importer };
}

export interface RegisteredImporter {
  moduleId: string;
  importer: Importer;
}

export interface ImporterCatalog {
  list(): RegisteredImporter[];
  get(id: string): RegisteredImporter | null;
}

/** The importers of the enabled modules; a disabled module's source is not offered. */
export function createImporterCatalog(
  contributions: () => FromModule<ImporterDefinition>[],
  isEnabled: (moduleId: string) => boolean = () => true,
): ImporterCatalog {
  const list = () =>
    contributions()
      .filter((entry) => isEnabled(entry.moduleId) && isImporter(entry.definition))
      .map((entry) => ({ moduleId: entry.moduleId, importer: entry.definition as Importer }));
  return {
    list,
    get: (id) => list().find((entry) => entry.importer.id === id) ?? null,
  };
}

export function describeSource(entry: RegisteredImporter): ImportSource {
  const { importer } = entry;
  return importSourceSchema.parse({
    id: importer.id,
    moduleId: entry.moduleId,
    label: importer.label,
    description: importer.description,
    brings: [...importer.brings],
    fields: [...importer.fields],
    ...(importer.nouns ? { nouns: importer.nouns } : {}),
  });
}

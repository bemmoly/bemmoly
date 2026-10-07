import { NotFoundError } from '@bemmoly/shared';
import type { SettingDefinition } from '../../contracts/settings.ts';
import type { ModuleRegistry } from '../../modules/registry.ts';
import { KERNEL_SETTINGS } from './kernel-settings.ts';

export interface CatalogEntry {
  definition: SettingDefinition;
  /** The module that declared it; undefined for kernel settings. */
  moduleId?: string;
}

/** Every known setting definition: the kernel's, then each loaded module's. */
export interface SettingsCatalog {
  get(key: string): CatalogEntry;
  has(key: string): boolean;
  list(): CatalogEntry[];
}

export function createSettingsCatalog(
  modules?: ModuleRegistry,
  kernel: readonly SettingDefinition[] = KERNEL_SETTINGS,
): SettingsCatalog {
  const entries = new Map<string, CatalogEntry>();
  for (const definition of kernel) entries.set(definition.key, { definition });
  for (const loaded of modules?.list() ?? []) {
    for (const definition of loaded.contributions.settings) {
      entries.set(definition.key, { definition, moduleId: loaded.module.id });
    }
  }
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) throw new NotFoundError(`There is no setting "${key}"`);
      return entry;
    },
    has: (key) => entries.has(key),
    list: () =>
      [...entries.values()].sort((a, b) => a.definition.key.localeCompare(b.definition.key)),
  };
}

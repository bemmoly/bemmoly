import type { ModuleManifest } from '@bemmoly/shared';
import type { CollabDocumentDefinition } from './collab.ts';
import type { BemmolyModule } from './contract.ts';
import type { ModuleContributions } from './contributions.ts';
import { ModuleLoadError } from './errors.ts';
import type {
  CapabilityDefinition,
  RouteDefinition,
  SearchProviderDefinition,
} from './registries.ts';

export interface LoadedModule {
  module: BemmolyModule;
  contributions: ModuleContributions;
}

export type FromModule<T> = T & { moduleId: string };

/** The modules enabled for this process, in load (dependency) order. */
export class ModuleRegistry {
  readonly #loaded = new Map<string, LoadedModule>();

  add(module: BemmolyModule, contributions: ModuleContributions): void {
    if (this.#loaded.has(module.id)) {
      throw new ModuleLoadError(`Module "${module.id}" is registered twice`, module.id);
    }
    for (const route of contributions.routes) {
      const owner = this.routes().find((existing) => existing.prefix === route.prefix);
      if (owner) {
        throw new ModuleLoadError(
          `Module "${module.id}": route prefix "${route.prefix}" is already used by "${owner.moduleId}"`,
          module.id,
        );
      }
    }
    this.#loaded.set(module.id, { module, contributions });
  }

  has(id: string): boolean {
    return this.#loaded.has(id);
  }

  get(id: string): LoadedModule | undefined {
    return this.#loaded.get(id);
  }

  list(): LoadedModule[] {
    return [...this.#loaded.values()];
  }

  ids(): string[] {
    return [...this.#loaded.keys()];
  }

  manifests(): ModuleManifest[] {
    return this.list().map(({ module, contributions }) => ({
      id: module.id,
      name: module.name ?? module.id.charAt(0).toUpperCase() + module.id.slice(1),
      version: module.version,
      navigation: [...contributions.navigation],
      ...(contributions.searchProviders.length > 0
        ? {
            search: contributions.searchProviders.map(({ kind, label }) => ({ kind, label })),
          }
        : {}),
    }));
  }

  routes(): FromModule<RouteDefinition>[] {
    return this.#collect((c) => c.routes);
  }

  searchProviders(): FromModule<SearchProviderDefinition>[] {
    return this.#collect((c) => c.searchProviders);
  }

  collabDocuments(): FromModule<CollabDocumentDefinition>[] {
    return this.#collect((c) => c.collabDocuments);
  }

  capabilities(): FromModule<CapabilityDefinition>[] {
    return this.#collect((c) => c.capabilities);
  }

  #collect<T extends object>(pick: (c: ModuleContributions) => readonly T[]): FromModule<T>[] {
    return this.list().flatMap(({ module, contributions }) =>
      pick(contributions).map((item) => ({ ...item, moduleId: module.id })),
    );
  }
}

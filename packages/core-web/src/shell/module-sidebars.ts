import type { ModuleManifest } from '@bemmoly/shared';
import type { ComponentType } from 'react';
import { preloadable, type Preloadable } from '../modules/preloadable.ts';

/** What a module's sidebar entry draws its live rows from. */
export interface ModuleSidebarProps {
  manifest: ModuleManifest;
}

export type ModuleSidebarLoader = () => Promise<{ default: ComponentType<ModuleSidebarProps> }>;

/**
 * The sidebar entry each module ships (`web/src/sidebar.tsx`): a small file of its own, loaded
 * as soon as the shell knows which modules are on and never together with a screen, so the
 * sidebar never waits for a module's screens to download. Until it lands, the section shows
 * its heading and fixed links.
 */
export function createSidebarRegistry(loaders: Readonly<Record<string, ModuleSidebarLoader>>) {
  const cache = new Map<string, Preloadable<ModuleSidebarProps>>();
  const resolve = (moduleId: string) => {
    const loader = loaders[moduleId];
    if (!loader) return null;
    let entry = cache.get(moduleId);
    if (!entry) {
      entry = preloadable(loader);
      cache.set(moduleId, entry);
    }
    return entry;
  };
  return {
    resolve,
    /** Starts every enabled module's entry loading at once. */
    preload(manifests: readonly ModuleManifest[]) {
      for (const manifest of manifests)
        void resolve(manifest.id)
          ?.load()
          .catch(() => undefined);
    },
  };
}

export type SidebarRegistry = ReturnType<typeof createSidebarRegistry>;

/** Modules in sidebar order: their declared order, then the server's. */
export function inSidebarOrder(manifests: readonly ModuleManifest[]): ModuleManifest[] {
  return manifests
    .map((manifest, index) => ({ manifest, index }))
    .sort((a, b) => (a.manifest.order ?? 50) - (b.manifest.order ?? 50) || a.index - b.index)
    .map(({ manifest }) => manifest);
}

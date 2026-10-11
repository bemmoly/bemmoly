import type { ModuleManifest } from '@bemmoly/shared';
import type { ComponentType } from 'react';
import type { PageCrumb } from '../shell/page-header.tsx';
import { preloadable, type Preloadable } from './preloadable.ts';

/** What a module's settings entry is handed for the page under its settings path. */
export interface ModuleSettingsProps {
  manifest: ModuleManifest;
  /** The part of the path after the module's settings path, e.g. "/board" or "/". */
  subpath: string;
  /** "Settings / Modules / Work": the trail its pages start from, each one linking. */
  crumbs: readonly PageCrumb[];
}

export type ModuleSettingsLoader = () => Promise<{ default: ComponentType<ModuleSettingsProps> }>;

/**
 * The settings entry each module may ship (`web/src/settings.tsx`), loaded when a person opens
 * the module's row in Settings and never with its screens. The entry draws its own page layout
 * in the frame, so a list can sit in the reading column and an editor can go full width.
 */
export function createSettingsRegistry(loaders: Readonly<Record<string, ModuleSettingsLoader>>) {
  const cache = new Map<string, Preloadable<ModuleSettingsProps>>();
  return {
    /** The module's entry, or null when it ships none. */
    resolve(moduleId: string): Preloadable<ModuleSettingsProps> | null {
      const loader = loaders[moduleId];
      if (!loader) return null;
      let entry = cache.get(moduleId);
      if (!entry) {
        entry = preloadable(loader);
        cache.set(moduleId, entry);
      }
      return entry;
    },
  };
}

export type SettingsRegistry = ReturnType<typeof createSettingsRegistry>;

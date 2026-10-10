import type { ModuleManifest } from '@bemmoly/shared';
import { createElement, type ComponentType, type ReactElement } from 'react';
import { preloadable, type Preloadable } from './preloadable.ts';

export interface ModuleChunkProps {
  manifest: ModuleManifest;
  /** The part of the path after /<module id>, e.g. "/boards/12". */
  subpath: string;
}

export type ModuleChunk = Preloadable<ModuleChunkProps>;
export type ModuleChunkLoader = () => Promise<{ default: ComponentType<ModuleChunkProps> }>;

/**
 * One lazily loaded chunk per module, created once per id so React keeps a
 * stable component identity across renders. A module that ships no chunk
 * gets the fallback, which keeps an enabled module visible while its UI lands.
 * Each chunk can be loaded ahead of rendering (ModuleOutlet does), so opening a
 * module never waits on a Suspense fallback.
 */
export function createChunkRegistry(
  loaders: Readonly<Record<string, ModuleChunkLoader>>,
  fallback: ModuleChunkLoader,
) {
  const cache = new Map<string, ModuleChunk>();
  const fallbackChunk = preloadable(fallback);
  const registry = {
    resolve(moduleId: string): ModuleChunk {
      const loader = loaders[moduleId];
      if (!loader) return fallbackChunk;
      let chunk = cache.get(moduleId);
      if (!chunk) {
        chunk = preloadable(loader);
        cache.set(moduleId, chunk);
      }
      return chunk;
    },
    has: (moduleId: string) => moduleId in loaders,
  };
  return {
    ...registry,
    /** The chunk as an element; the component itself is cached, never created per render. */
    element: (props: ModuleChunkProps): ReactElement =>
      createElement(registry.resolve(props.manifest.id).Component, props),
  };
}

export type ChunkRegistry = ReturnType<typeof createChunkRegistry>;

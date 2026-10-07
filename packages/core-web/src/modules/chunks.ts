import type { ModuleManifest } from '@bemmoly/shared';
import {
  createElement,
  lazy,
  type ComponentType,
  type LazyExoticComponent,
  type ReactElement,
} from 'react';

export interface ModuleChunkProps {
  manifest: ModuleManifest;
  /** The part of the path after /<module id>, e.g. "/boards/12". */
  subpath: string;
}

export type ModuleChunk = LazyExoticComponent<ComponentType<ModuleChunkProps>>;
export type ModuleChunkLoader = () => Promise<{ default: ComponentType<ModuleChunkProps> }>;

/**
 * One lazily loaded chunk per module, created once per id so React keeps a
 * stable component identity across renders. A module that ships no chunk
 * gets the fallback, which keeps an enabled module visible while its UI lands.
 */
export function createChunkRegistry(
  loaders: Readonly<Record<string, ModuleChunkLoader>>,
  fallback: ModuleChunkLoader,
) {
  const cache = new Map<string, ModuleChunk>();
  const fallbackChunk = lazy(fallback);
  const registry = {
    resolve(moduleId: string): ModuleChunk {
      const loader = loaders[moduleId];
      if (!loader) return fallbackChunk;
      let chunk = cache.get(moduleId);
      if (!chunk) {
        chunk = lazy(loader);
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
      createElement(registry.resolve(props.manifest.id), props),
  };
}

export type ChunkRegistry = ReturnType<typeof createChunkRegistry>;

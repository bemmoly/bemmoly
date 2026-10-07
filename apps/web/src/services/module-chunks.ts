import type { ModuleManifest } from '@bemmoly/shared';
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export interface ModuleChunkProps {
  manifest: ModuleManifest;
}

export type ModuleChunk = LazyExoticComponent<ComponentType<ModuleChunkProps>>;

/** Shown for any enabled module that has not shipped its own web chunk yet. */
export const PlaceholderChunk: ModuleChunk = lazy(() => import('../pages/module-placeholder.tsx'));

/**
 * One lazily loaded chunk per module, declared once at module scope so each
 * keeps a stable identity. Module web chunks register here as they ship.
 */
export const MODULE_CHUNKS: Readonly<Record<string, ModuleChunk>> = {};

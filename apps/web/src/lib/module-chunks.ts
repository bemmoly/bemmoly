import {
  createChunkRegistry,
  type ModuleChunkLoader,
  type ModuleChunkProps,
} from '@bemmoly/core-web';
import type { ComponentType } from 'react';

/**
 * One lazy chunk per module, keyed by module id. The shell never imports a
 * module by name; it discovers each module's web entry by folder, the way the
 * host discovers module packages, so a module that ships a chunk is picked up
 * and one that does not shows the placeholder.
 */
const ENTRIES = import.meta.glob<{ default: ComponentType<ModuleChunkProps> }>(
  '../../../../modules/*/web/src/index.tsx',
);

const loaders: Record<string, ModuleChunkLoader> = {};
for (const [path, load] of Object.entries(ENTRIES)) {
  const moduleId = /\/modules\/([^/]+)\/web\//.exec(path)?.[1];
  if (moduleId) loaders[moduleId] = load;
}

export const MODULE_CHUNKS = createChunkRegistry(
  loaders,
  () => import('../pages/module-placeholder.tsx'),
);

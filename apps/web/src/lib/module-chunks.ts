import { createChunkRegistry } from '@bemmoly/core-web';

/**
 * One lazy chunk per module, keyed by module id. Module web chunks register a
 * loader here as they ship; until then an enabled module shows the placeholder.
 */
export const MODULE_CHUNKS = createChunkRegistry(
  {},
  () => import('../pages/module-placeholder.tsx'),
);

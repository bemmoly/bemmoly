import {
  createEntityRendererRegistry,
  type EntityRenderer,
  type EntityRenderersLoader,
} from '@bemmoly/core-web';

/**
 * The renderers each module lends for the records it owns, keyed by module id
 * and discovered by folder as the module chunks are: a module with
 * `web/src/entities.tsx` lends them, one without lends nothing. The shell
 * never names a module.
 */
const ENTRIES = import.meta.glob<{ default: readonly EntityRenderer[] }>(
  '../../../../modules/*/web/src/entities.tsx',
);

const loaders: Record<string, EntityRenderersLoader> = {};
for (const [path, load] of Object.entries(ENTRIES)) {
  const moduleId = /\/modules\/([^/]+)\/web\//.exec(path)?.[1];
  if (moduleId) loaders[moduleId] = load;
}

export const ENTITY_RENDERERS = createEntityRendererRegistry(loaders);

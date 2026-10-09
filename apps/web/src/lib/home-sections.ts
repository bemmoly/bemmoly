import {
  createHomeSectionRegistry,
  type HomeSectionLoader,
  type HomeSectionProps,
} from '@bemmoly/core-web';
import type { ComponentType } from 'react';

/**
 * The Home section each module ships, keyed by module id and discovered by
 * folder as the module chunks are: a module with `web/src/home.tsx` adds a
 * section to Home, one without adds nothing. The shell never names a module.
 */
const ENTRIES = import.meta.glob<{ default: ComponentType<HomeSectionProps> }>(
  '../../../../modules/*/web/src/home.tsx',
);

const loaders: Record<string, HomeSectionLoader> = {};
for (const [path, load] of Object.entries(ENTRIES)) {
  const moduleId = /\/modules\/([^/]+)\/web\//.exec(path)?.[1];
  if (moduleId) loaders[moduleId] = load;
}

export const HOME_SECTIONS = createHomeSectionRegistry(loaders);

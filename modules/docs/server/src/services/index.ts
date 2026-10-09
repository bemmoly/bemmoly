import type { DocsServiceDeps } from './common.ts';
import { createPagesService } from './pages/index.ts';
import { createSpacesService } from './spaces/index.ts';

export type { DocsServiceDeps } from './common.ts';

/**
 * Every Docs service, built once at boot. Each area adds its factory here and
 * nowhere else, so module.ts never grows with the module.
 */
export function createDocsServices(deps: DocsServiceDeps) {
  return {
    spaces: createSpacesService(deps),
    pages: createPagesService(deps),
  };
}

export type DocsServices = ReturnType<typeof createDocsServices>;

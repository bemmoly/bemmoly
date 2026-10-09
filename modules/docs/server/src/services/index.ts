import type { DocsServiceDeps } from './common.ts';
import { createPagesService } from './pages/index.ts';
import { createSpacesService } from './spaces/index.ts';
import { createStatusService } from './status/index.ts';
import { createTreeService } from './tree/index.ts';

export type { DocsServiceDeps } from './common.ts';

/**
 * Every Docs service, built once at boot. Each area adds its factory here and
 * nowhere else, so module.ts never grows with the module.
 */
export function createDocsServices(deps: DocsServiceDeps) {
  return {
    spaces: createSpacesService(deps),
    pages: createPagesService(deps),
    tree: createTreeService(deps),
    status: createStatusService(deps),
  };
}

export type DocsServices = ReturnType<typeof createDocsServices>;

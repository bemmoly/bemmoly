import type { DocsServiceDeps } from './common.ts';
import { createHomeService } from './home/index.ts';
import { createPagesService } from './pages/index.ts';
import { createSearchService } from './search/index.ts';
import { createSpacesService } from './spaces/index.ts';
import { createStarsLabelsService } from './stars-labels/index.ts';
import { createStatusService } from './status/index.ts';
import { createTemplatesService } from './templates/index.ts';
import { createTreeService } from './tree/index.ts';

export type { DocsServiceDeps } from './common.ts';

/**
 * Every Docs service, built once at boot. Each area adds its factory here and
 * nowhere else, so module.ts never grows with the module.
 */
export function createDocsServices(deps: DocsServiceDeps) {
  const pages = createPagesService(deps);
  return {
    spaces: createSpacesService(deps),
    pages,
    tree: createTreeService(deps),
    status: createStatusService(deps),
    starsLabels: createStarsLabelsService(deps),
    templates: createTemplatesService({ ...deps, pages }),
    home: createHomeService(deps),
    search: createSearchService(deps),
  };
}

export type DocsServices = ReturnType<typeof createDocsServices>;

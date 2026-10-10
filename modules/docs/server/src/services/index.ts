import { createPageCollab } from './collab/index.ts';
import type { DocsServiceDeps } from './common.ts';
import { createCommentsService } from './comments/index.ts';
import { createHomeService } from './home/index.ts';
import { createLinksService } from './links/index.ts';
import { createPagesService } from './pages/index.ts';
import { createRevisionsService } from './revisions/index.ts';
import { createSearchService } from './search/index.ts';
import { createSpacesService } from './spaces/index.ts';
import { createStarsLabelsService } from './stars-labels/index.ts';
import { createStatusService } from './status/index.ts';
import { createTemplatesService } from './templates/index.ts';
import { createTransferService } from './transfer/index.ts';
import { createTreeService } from './tree/index.ts';

export type { DocsServiceDeps } from './common.ts';

/**
 * Every Docs service, built once at boot. Each area adds its factory here and
 * nowhere else, so module.ts never grows with the module.
 */
export function createDocsServices(deps: DocsServiceDeps) {
  const collab = createPageCollab(deps);
  const pages = createPagesService(deps, collab);
  return {
    collab,
    spaces: createSpacesService(deps),
    pages,
    tree: createTreeService(deps),
    status: createStatusService(deps),
    starsLabels: createStarsLabelsService(deps),
    templates: createTemplatesService({ ...deps, pages }),
    home: createHomeService(deps),
    search: createSearchService(deps),
    revisions: createRevisionsService(deps, collab),
    links: createLinksService(deps),
    comments: createCommentsService(deps),
    transfer: createTransferService(deps),
  };
}

export type DocsServices = ReturnType<typeof createDocsServices>;

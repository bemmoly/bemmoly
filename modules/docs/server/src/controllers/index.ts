import type { DocsServices } from '../services/index.ts';
import { createLibraryController } from './library.controller.ts';
import { createPagesController } from './pages.controller.ts';
import { createRevisionsController } from './revisions.controller.ts';
import { createSearchController } from './search.controller.ts';
import { createSpacesController } from './spaces.controller.ts';
import { createTreeController } from './tree.controller.ts';

/** One controller per area, each over its own service; areas add a line here. */
export function createDocsControllers(services: DocsServices) {
  return {
    spaces: createSpacesController(services.spaces),
    pages: createPagesController(services.pages),
    tree: createTreeController(services.tree, services.status),
    library: createLibraryController(services),
    search: createSearchController(services.search),
    revisions: createRevisionsController(services.revisions),
  };
}

export type DocsControllers = ReturnType<typeof createDocsControllers>;

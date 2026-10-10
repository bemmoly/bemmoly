import type { DocsServices } from '../services/index.ts';
import { createLibraryController } from './library.controller.ts';
import { createCommentsController } from './comments.controller.ts';
import { createLinksController } from './links.controller.ts';
import { createPagesController } from './pages.controller.ts';
import { createRevisionsController } from './revisions.controller.ts';
import { createTransferController } from './transfer.controller.ts';
import { createSearchController } from './search.controller.ts';
import { createMembersController } from './members.controller.ts';
import { createSpacesController } from './spaces.controller.ts';
import { createTreeController } from './tree.controller.ts';

/** One controller per area, each over its own service; areas add a line here. */
export function createDocsControllers(services: DocsServices) {
  return {
    spaces: createSpacesController(services.spaces),
    members: createMembersController(services.members),
    pages: createPagesController(services.pages),
    tree: createTreeController(services.tree, services.status),
    library: createLibraryController(services),
    search: createSearchController(services.search),
    revisions: createRevisionsController(services.revisions),
    links: createLinksController(services.links),
    comments: createCommentsController(services.comments),
    transfer: createTransferController(services.transfer),
  };
}

export type DocsControllers = ReturnType<typeof createDocsControllers>;

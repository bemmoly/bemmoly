import type { DocsServices } from '../services/index.ts';
import { createPagesController } from './pages.controller.ts';
import { createSpacesController } from './spaces.controller.ts';

/** One controller per area, each over its own service; areas add a line here. */
export function createDocsControllers(services: DocsServices) {
  return {
    spaces: createSpacesController(services.spaces),
    pages: createPagesController(services.pages),
  };
}

export type DocsControllers = ReturnType<typeof createDocsControllers>;

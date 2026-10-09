import type { DocsServices } from '../services/index.ts';
import { createSpacesController } from './spaces.controller.ts';

/** One controller per area, each over its own service; areas add a line here. */
export function createDocsControllers(services: DocsServices) {
  return {
    spaces: createSpacesController(services.spaces),
  };
}

export type DocsControllers = ReturnType<typeof createDocsControllers>;

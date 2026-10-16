import type { PipelinesServices } from '../services/index.ts';
import { createAccessController } from './access.controller.ts';
import { createCatalogController } from './catalog.controller.ts';
import { createOrganisationController } from './environments.controller.ts';
import { createStreamsController } from './streams.controller.ts';

export function createPipelinesControllers(services: PipelinesServices) {
  return {
    access: createAccessController(services.access),
    catalog: createCatalogController(services.catalog),
    organisation: createOrganisationController(services),
    streams: createStreamsController(services.streams),
  };
}

export type PipelinesControllers = ReturnType<typeof createPipelinesControllers>;

import type { PipelinesServices } from '../services/index.ts';
import { createCatalogController } from './catalog.controller.ts';
import { createOrganisationController } from './environments.controller.ts';

export function createPipelinesControllers(services: PipelinesServices) {
  return {
    catalog: createCatalogController(services.catalog),
    organisation: createOrganisationController(services),
  };
}

export type PipelinesControllers = ReturnType<typeof createPipelinesControllers>;

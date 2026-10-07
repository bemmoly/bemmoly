import type { ModulesResponse } from '@bemmoly/shared';
import type { ModuleRegistry } from '../modules/registry.ts';
import { listModuleManifests } from '../services/modules/index.ts';

export function createModulesController(registry: ModuleRegistry) {
  return {
    list(): ModulesResponse {
      return { items: listModuleManifests(registry) };
    },
  };
}

export type ModulesController = ReturnType<typeof createModulesController>;

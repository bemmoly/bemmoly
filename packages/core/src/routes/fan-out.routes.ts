import type { FastifyPluginAsync } from 'fastify';
import { createSearchController } from '../controllers/search.controller.ts';
import { createStartController } from '../controllers/start.controller.ts';
import type { ModuleRegistry } from '../modules/registry.ts';
import { createSearchService } from '../services/search/index.ts';
import { createStartService } from '../services/start/index.ts';
import { searchRoutes } from './search.routes.ts';
import { startRoutes } from './start.routes.ts';

/** The kernel endpoints that ask every enabled module the person can open: ⌘K and the start page. */
export function fanOutRoutes(
  modules: ModuleRegistry,
  isEnabled: (moduleId: string) => boolean,
): FastifyPluginAsync {
  const search = createSearchController(
    createSearchService({ providers: () => modules.searchProviders(), isEnabled }),
  );
  const start = createStartController(
    createStartService({ sources: () => modules.startSources(), isEnabled }),
  );
  return async (api) => {
    await api.register(searchRoutes(search));
    await api.register(startRoutes(start));
  };
}

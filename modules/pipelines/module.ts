import { defineModule, loadChangelogFolder } from '@bemmoly/core';
import { PIPELINES_CAPABILITIES } from './server/src/config/capabilities.ts';
import { definePipelinesSettings } from './server/src/config/settings.ts';
import { createPipelinesControllers } from './server/src/controllers/index.ts';
import { pipelinesRoutes } from './server/src/routes/index.ts';
import { createPipelinesServices } from './server/src/services/index.ts';

/**
 * Bemmoly Pipelines, the server side. A product with its own web app (apps/pipelines-web) and
 * front door, so it contributes nothing to Bemmoly's frame: no sidebar, navigation, Home or
 * create entries. The module grant is "who may use Pipelines"; inside, role bindings and
 * policies decide.
 */
export default defineModule({
  id: 'pipelines',
  name: 'Pipelines',
  version: '0.1.0',
  coreApi: '^0.1.0',
  defaultAccess: 'teams',
  surface: 'product',
  icon: 'rocket',
  color: 'accent',
  order: 90,
  changelog: await loadChangelogFolder(new URL('./changelog/', import.meta.url)),
  register(ctx) {
    for (const capability of PIPELINES_CAPABILITIES) ctx.capabilities.add(capability);
    definePipelinesSettings(ctx.settings);
    const services = createPipelinesServices({
      ...(ctx.database ? { database: ctx.database } : {}),
      settings: ctx.settings,
    });
    ctx.routes.add({
      prefix: '/pipelines',
      plugin: pipelinesRoutes(createPipelinesControllers(services)),
    });
  },
});

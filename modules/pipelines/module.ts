import { defineModule, loadChangelogFolder } from '@bemmoly/core';
import { PIPELINES_CAPABILITIES } from './server/src/config/capabilities.ts';
import { discoveryJob } from './server/src/config/jobs.ts';
import { landingZoneApplyJob, landingZoneDriftJob } from './server/src/config/landing-zone-jobs.ts';
import { definePipelinesSettings } from './server/src/config/settings.ts';
import { jobWaker, shippingJobs } from './server/src/config/shipping-jobs.ts';
import { defineShippingSettings } from './server/src/config/shipping-settings.ts';
import { createPipelinesControllers } from './server/src/controllers/index.ts';
import { pipelinesRoutes, runnerRoutes } from './server/src/routes/index.ts';
import { registerCodeHostWork } from './server/src/config/code-hosts.ts';
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
    defineShippingSettings(ctx.settings);
    const services = createPipelinesServices({
      ...(ctx.database ? { database: ctx.database } : {}),
      settings: ctx.settings,
      codeHosts: ctx.code.hosts(),
      sendJob: (name, payload, options) => ctx.jobs.send(name, payload, options),
      objects: ctx.objects,
      wake: jobWaker(ctx.jobs),
    });
    registerCodeHostWork(ctx, services);
    ctx.jobs.add(landingZoneApplyJob(services.clouds));
    ctx.jobs.add(landingZoneDriftJob(services.clouds));
    ctx.jobs.add(discoveryJob(services.discovery));
    for (const job of shippingJobs(() => services.shipping?.engine)) ctx.jobs.add(job);
    const controllers = createPipelinesControllers(services);
    ctx.routes.add({ prefix: '/pipelines', plugin: pipelinesRoutes(controllers) });
    // Build runners call in with their own tokens, under a protocol versioned apart (§22).
    ctx.routes.add({ prefix: '/runner', plugin: runnerRoutes(controllers.runner) });
  },
});

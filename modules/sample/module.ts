import { defineModule, loadChangelogFolder } from '@bemmoly/core';
import { z } from 'zod';
import { createItemsController } from './server/src/controllers/items.controller.ts';
import { sampleRoutes } from './server/src/routes/items.routes.ts';
import { createItemsService, SAMPLE_PING_JOB } from './server/src/services/items.ts';

declare module '@bemmoly/core' {
  interface SettingsKeys {
    'sample.greeting': string;
  }
}

/**
 * Throwaway module that proves the contract end to end: a changeset, a route,
 * a job, a setting, a realtime message and a domain event, all through the
 * kernel's registries. A developer example: it ships in the image but, like
 * every module, stays off until an admin enables it, and suggests no access.
 */
export default defineModule({
  id: 'sample',
  name: 'Sample',
  version: '0.0.0',
  coreApi: '^0.1.0',
  defaultAccess: 'none',
  icon: 'box',
  color: 'epic-4',
  order: 90,
  sidebar: { path: '/sample' },
  changelog: await loadChangelogFolder(new URL('./changelog/', import.meta.url)),
  register(ctx) {
    ctx.navigation.add({ id: 'sample', label: 'Sample', path: '/sample', placement: 'top' });
    ctx.capabilities.add({
      name: 'sample.view',
      label: 'View the sample module',
      group: 'Sample',
      defaults: {
        org_admin: true,
        project_admin: true,
        member: true,
        viewer: true,
        contractor: false,
      },
    });
    ctx.settings.define({
      key: 'sample.greeting',
      schema: z.string().trim().min(1).max(120),
      default: 'Hello from the sample module',
    });
    const service = createItemsService({
      realtime: ctx.realtime,
      events: ctx.events,
      jobs: ctx.jobs,
      settings: ctx.settings,
      ...(ctx.database ? { database: ctx.database } : {}),
    });
    ctx.jobs.add({
      name: SAMPLE_PING_JOB,
      handle: async () => {
        await service.recordPing();
      },
    });
    ctx.routes.add({ prefix: '/sample', plugin: sampleRoutes(createItemsController(service)) });
  },
});

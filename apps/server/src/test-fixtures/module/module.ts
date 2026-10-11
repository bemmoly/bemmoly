import { defineModule, loadChangelogFolder } from '@bemmoly/core';
import { z } from 'zod';
import { createItemsService, FIXTURE_PING_JOB } from './items.ts';
import { fixtureRoutes } from './routes.ts';

declare module '@bemmoly/core' {
  interface SettingsKeys {
    'fixture.greeting': string;
  }
}

/**
 * A test-only module that proves the module contract end to end: a changeset, a
 * route, a job, a setting, a realtime message and a domain event, all through the
 * kernel's registries. It is never in MODULE_PACKAGES and never in the image; the
 * host's tests add it to the modules they boot with.
 */
export default defineModule({
  id: 'fixture',
  name: 'Fixture',
  version: '0.0.0',
  coreApi: '^0.1.0',
  defaultAccess: 'none',
  icon: 'box',
  color: 'epic-4',
  order: 90,
  sidebar: { path: '/fixture' },
  changelog: await loadChangelogFolder(new URL('./changelog/', import.meta.url)),
  register(ctx) {
    ctx.navigation.add({ id: 'fixture', label: 'Fixture', path: '/fixture', placement: 'top' });
    ctx.capabilities.add({
      name: 'fixture.view',
      label: 'View the fixture module',
      group: 'Fixture',
      defaults: {
        org_admin: true,
        project_admin: true,
        member: true,
        viewer: true,
        contractor: false,
      },
    });
    ctx.settings.define({
      key: 'fixture.greeting',
      schema: z.string().trim().min(1).max(120),
      default: 'Hello from the fixture module',
    });
    const service = createItemsService({
      realtime: ctx.realtime,
      events: ctx.events,
      jobs: ctx.jobs,
      settings: ctx.settings,
      ...(ctx.database ? { database: ctx.database } : {}),
    });
    ctx.jobs.add({
      name: FIXTURE_PING_JOB,
      handle: async () => {
        await service.recordPing();
      },
    });
    ctx.routes.add({ prefix: '/fixture', plugin: fixtureRoutes(service) });
  },
});

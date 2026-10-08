import { defineModule, loadChangelogFolder } from '@bemmoly/core';
import { WORK_CAPABILITIES } from './server/src/config/capabilities.ts';
import { defineWorkSettings } from './server/src/config/settings.ts';
import { createWorkControllers } from './server/src/controllers/index.ts';
import { workRoutes } from './server/src/routes/index.ts';
import { createWorkServices } from './server/src/services/index.ts';
import { WORK_RANK_REBALANCE_JOB } from './server/src/services/jobs.ts';

/**
 * Issues, boards, backlogs, sprints and workflows. Off until an admin enables
 * it; suggests team access, as the tech design gives Work and Docs.
 */
export default defineModule({
  id: 'work',
  name: 'Work',
  version: '0.2.0',
  coreApi: '^0.1.0',
  defaultAccess: 'teams',
  changelog: await loadChangelogFolder(new URL('./changelog/', import.meta.url)),
  register(ctx) {
    ctx.navigation.add({ id: 'work.board', label: 'Board', path: '/work/board', placement: 'top' });
    ctx.navigation.add({
      id: 'work.backlog',
      label: 'Backlog',
      path: '/work/backlog',
      placement: 'top',
    });
    for (const capability of WORK_CAPABILITIES) ctx.capabilities.add(capability);
    defineWorkSettings(ctx.settings);
    const services = createWorkServices(ctx.database ? { database: ctx.database } : {});
    ctx.jobs.add({
      name: WORK_RANK_REBALANCE_JOB,
      scheduleSetting: 'work.jobs.rankRebalance.schedule',
      singleton: true,
      /** Reserved here so the schedule exists; the rebalance itself lands with ranking. */
      handle: async () => undefined,
    });
    ctx.routes.add({ prefix: '/work', plugin: workRoutes(createWorkControllers(services)) });
  },
});

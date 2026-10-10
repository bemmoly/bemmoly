import { defineModule, loadChangelogFolder } from '@bemmoly/core';
import { WORK_CAPABILITIES } from './server/src/config/capabilities.ts';
import { defineWorkSettings } from './server/src/config/settings.ts';
import { createWorkControllers } from './server/src/controllers/index.ts';
import { workRoutes } from './server/src/routes/index.ts';
import { createWorkServices } from './server/src/services/index.ts';
import { WORK_AUTOMATION_RUN_JOB, WORK_RANK_REBALANCE_JOB } from './server/src/services/jobs.ts';
import { registerWorkSearch } from './server/src/services/palette/index.ts';
import { registerWorkReferences } from './server/src/services/references/index.ts';

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
  icon: 'board',
  color: 'brand-1',
  order: 10,
  sidebar: {
    path: '/work/projects',
    links: [
      { id: 'work.all-projects', label: 'All projects', path: '/work/projects', icon: 'layers' },
    ],
    primary: [{ id: 'work.my-issues', label: 'My issues', path: '/work/my-issues', icon: 'me' }],
    add: { create: 'work.create-project', label: 'New project' },
  },
  changelog: await loadChangelogFolder(new URL('./changelog/', import.meta.url)),
  register(ctx) {
    /** One top-level area; the sidebar section draws the projects and their views. */
    ctx.navigation.add({
      id: 'work.home',
      label: 'Work',
      path: '/work/board',
      placement: 'top',
      icon: 'board',
    });
    ctx.navigation.add({
      id: 'work.board',
      label: 'Board',
      path: '/work/board',
      placement: 'command',
      icon: 'board',
      keys: 'G B',
    });
    ctx.navigation.add({
      id: 'work.backlog',
      label: 'Backlog',
      path: '/work/backlog',
      placement: 'command',
      icon: 'backlog',
      keys: 'G L',
    });
    ctx.navigation.add({
      id: 'work.projects',
      label: 'Projects',
      path: '/work/projects',
      placement: 'command',
      icon: 'layers',
    });
    ctx.navigation.add({
      id: 'work.create-issue',
      label: 'Issue',
      path: '/work/create',
      placement: 'create',
      icon: 'check',
    });
    ctx.navigation.add({
      id: 'work.create-project',
      label: 'Project',
      path: '/work/projects/new',
      placement: 'create',
      icon: 'project',
    });
    for (const capability of WORK_CAPABILITIES) ctx.capabilities.add(capability);
    defineWorkSettings(ctx.settings);
    const services = createWorkServices({
      realtime: ctx.realtime,
      events: ctx.events,
      jobs: ctx.jobs,
      ...(ctx.database ? { database: ctx.database } : {}),
      ...(ctx.audit ? { audit: ctx.audit } : {}),
      ...(ctx.memberships ? { memberships: ctx.memberships } : {}),
    });
    ctx.jobs.add({
      name: WORK_RANK_REBALANCE_JOB,
      scheduleSetting: 'work.jobs.rankRebalance.schedule',
      singleton: true,
      /** Reserved here so the schedule exists; the rebalance itself lands with ranking. */
      handle: async () => undefined,
    });
    ctx.jobs.add({
      name: WORK_AUTOMATION_RUN_JOB,
      /** Reserved so a fire_automation post-action enqueues today; the engine lands later. */
      handle: async () => undefined,
    });
    registerWorkSearch(ctx.search, services.search, ctx.database);
    registerWorkReferences(ctx, ctx.database);
    ctx.routes.add({ prefix: '/work', plugin: workRoutes(createWorkControllers(services)) });
  },
});

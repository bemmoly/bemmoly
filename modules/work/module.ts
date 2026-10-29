import { defineModule, importerContribution, loadChangelogFolder } from '@bemmoly/core';
import { registerAskReports } from './server/src/config/ask-reports.ts';
import { WORK_CAPABILITIES } from './server/src/config/capabilities.ts';
import { defineWorkSettings } from './server/src/config/settings.ts';
import { createWorkControllers } from './server/src/controllers/index.ts';
import { registerWorkAiTools } from './server/src/services/ai-tools/index.ts';
import { registerWorkMcp } from './server/src/services/mcp/index.ts';
import { workRoutes } from './server/src/routes/index.ts';
import { createWorkServices } from './server/src/services/index.ts';
import { subscribeAutomation } from './server/src/services/automation/index.ts';
import {
  WORK_AUTOMATION_RUN_JOB,
  WORK_AUTOMATION_SCHEDULE_JOB,
  WORK_PROJECT_PURGE_JOB,
  WORK_RANK_REBALANCE_JOB,
} from './server/src/services/jobs.ts';
import { createCsvImporter } from './server/src/services/import/csv/index.ts';
import { createJiraImporter } from './server/src/services/import/jira/index.ts';
import { createWorkStartSource } from './server/src/services/my-work/start.ts';
import { registerWorkSearch } from './server/src/services/palette/index.ts';
import { registerWorkAi, withAiTriggers } from './server/src/services/ai/index.ts';
import { registerWorkReferences } from './server/src/services/references/index.ts';
import { registerWorkRetrieval } from './server/src/services/retrieval/index.ts';

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
      { id: 'work.roadmap', label: 'Roadmap', path: '/work/roadmap', icon: 'roadmap' },
      {
        id: 'work.initiatives',
        label: 'Initiatives',
        path: '/work/initiatives',
        icon: 'target',
      },
    ],
    primary: [{ id: 'work.my-issues', label: 'My issues', path: '/work/my-issues', icon: 'me' }],
    add: { create: 'work.create-project', label: 'New project' },
  },
  /** The org defaults every project inherits until it overrides them; workspace admins only. */
  settings: { path: '/settings/work' },
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
      id: 'work.roadmap',
      label: 'Roadmap',
      path: '/work/roadmap',
      placement: 'command',
      icon: 'roadmap',
      keys: 'G R',
    });
    ctx.navigation.add({
      id: 'work.initiatives',
      label: 'Initiatives',
      path: '/work/initiatives',
      placement: 'command',
      icon: 'target',
    });
    ctx.navigation.add({
      id: 'work.pairing',
      label: 'Pairing',
      path: '/work/pairing',
      placement: 'command',
      icon: 'grid',
      keys: 'G P',
    });
    ctx.navigation.add({
      id: 'work.reports',
      label: 'Reports',
      path: '/work/reports',
      placement: 'command',
      icon: 'reports',
      keys: 'G E',
    });
    ctx.navigation.add({
      id: 'work.dashboards',
      label: 'Dashboards',
      path: '/work/dashboards',
      placement: 'command',
      icon: 'pulse',
      keys: 'G D',
    });
    ctx.navigation.add({
      id: 'work.quarter',
      label: 'Quarter',
      path: '/work/quarter',
      placement: 'command',
      icon: 'calendar',
      keys: 'G Q',
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
      realtime: withAiTriggers(ctx.realtime, ctx.events),
      events: ctx.events,
      jobs: ctx.jobs,
      ...(ctx.database ? { database: ctx.database } : {}),
      ...(ctx.audit ? { audit: ctx.audit } : {}),
      ...(ctx.memberships ? { memberships: ctx.memberships } : {}),
      links: ctx.links,
      settings: ctx.settings,
      ...(ctx.contextFor ? { contextFor: ctx.contextFor } : {}),
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
      // A run records its own failure; retrying would repeat actions that already happened.
      retryLimit: 0,
      handle: (payload, job) => services.automation.handleJob(payload, job.requestId),
    });
    ctx.jobs.add({
      name: WORK_PROJECT_PURGE_JOB,
      // Each batch commits on its own, so a retry resumes where the last attempt stopped.
      expireInSeconds: 60 * 60,
      handle: (payload) => services.projects.handlePurgeJob(payload),
    });
    ctx.code.addConsumer(services.codeLinks.consumer);
    ctx.jobs.add({
      name: WORK_AUTOMATION_SCHEDULE_JOB,
      schedule: '* * * * *',
      singleton: true,
      handle: async () => void (await services.automation.tick()),
    });
    subscribeAutomation(ctx.events, services.automation);
    const importDeps = {
      ...(ctx.database ? { database: ctx.database } : {}),
      ...(ctx.memberships ? { memberships: ctx.memberships } : {}),
    };
    registerWorkSearch(ctx.search, services.search, ctx.database);
    ctx.start.add(createWorkStartSource(importDeps));
    registerWorkRetrieval(ctx);
    registerWorkReferences(ctx, ctx.database);
    registerWorkAiTools(ctx.ai, services);
    registerWorkMcp(ctx.mcp, services);
    registerWorkAi(ctx, ctx.database);
    const askReports = registerAskReports(ctx);
    ctx.importers.add(importerContribution(createJiraImporter(importDeps)));
    ctx.importers.add(importerContribution(createCsvImporter(importDeps)));
    const routes = workRoutes(createWorkControllers(services));
    ctx.routes.add({
      prefix: '/work',
      plugin: async (app) => {
        await app.register(routes);
        await app.register(askReports);
      },
    });
  },
});

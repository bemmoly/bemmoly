import { defineModule, loadChangelogFolder } from '@bemmoly/core';
import { PEOPLE_CAPABILITIES } from './server/src/config/capabilities.ts';
import { startJourneyJob, subscribePeopleEvents } from './server/src/config/events.ts';
import { createPeopleControllers } from './server/src/controllers/index.ts';
import { peopleRoutes } from './server/src/routes/index.ts';
import { createPeopleServices } from './server/src/services/index.ts';
import { createPeopleStartSource } from './server/src/services/start/index.ts';

/**
 * People: the directory and profiles over the kernel's person record, the org chart,
 * onboarding and offboarding journeys, and time off through the approval engine. Off until an
 * admin enables it; everyone at the company is in it, so it suggests access for everyone.
 */
export default defineModule({
  id: 'people',
  name: 'People',
  version: '0.1.0',
  coreApi: '^0.1.0',
  defaultAccess: 'everyone',
  icon: 'people',
  color: 'brand-3',
  order: 30,
  sidebar: {
    path: '/people',
    links: [
      { id: 'people.directory', label: 'Directory', path: '/people', icon: 'list' },
      { id: 'people.org', label: 'Org chart', path: '/people/org', icon: 'layers' },
      { id: 'people.time-off', label: 'Time off', path: '/people/time-off', icon: 'calendar' },
      { id: 'people.journeys', label: 'Journeys', path: '/people/journeys', icon: 'checklist' },
    ],
  },
  settings: { path: '/settings/people', requires: 'people.settings.manage' },
  changelog: await loadChangelogFolder(new URL('./changelog/', import.meta.url)),
  register(ctx) {
    ctx.navigation.add({
      id: 'people.home',
      label: 'People',
      path: '/people',
      placement: 'top',
      icon: 'people',
    });
    ctx.navigation.add({
      id: 'people.request-time-off',
      label: 'Time off',
      path: '/people/time-off/new',
      placement: 'create',
      icon: 'calendar',
    });
    for (const capability of PEOPLE_CAPABILITIES) ctx.capabilities.add(capability);
    const services = createPeopleServices({
      events: ctx.events,
      realtime: ctx.realtime,
      ...(ctx.database ? { database: ctx.database } : {}),
      ...(ctx.audit ? { audit: ctx.audit } : {}),
      ...(ctx.people ? { people: ctx.people } : {}),
      ...(ctx.approvals ? { approvals: ctx.approvals } : {}),
      ...(ctx.customFields ? { customFields: ctx.customFields } : {}),
    });
    ctx.jobs.add(startJourneyJob(services.journeys));
    subscribePeopleEvents(ctx, ctx.jobs, ctx.database);
    ctx.start.add(
      createPeopleStartSource({ ...(ctx.approvals ? { approvals: ctx.approvals } : {}) }, services),
    );
    ctx.routes.add({ prefix: '/hr', plugin: peopleRoutes(createPeopleControllers(services)) });
  },
});

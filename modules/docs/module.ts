import { defineModule, loadChangelogFolder } from '@bemmoly/core';
import { DOCS_CAPABILITIES } from './server/src/config/capabilities.ts';
import { defineDocsSettings } from './server/src/config/settings.ts';
import { createDocsControllers } from './server/src/controllers/index.ts';
import { compactJob } from './server/src/config/jobs.ts';
import { docsRoutes } from './server/src/routes/index.ts';
import { createDocsServices } from './server/src/services/index.ts';
import { registerDocsReferences } from './server/src/services/links/registry.ts';
import { registerDocsSearch } from './server/src/services/palette/index.ts';

/**
 * Spaces, page trees, templates and the collaborative editor. Off until an
 * admin enables it; suggests team access, as the tech design gives Work and
 * Docs. Boots and runs with Work disabled: nothing here imports Work.
 */
export default defineModule({
  id: 'docs',
  name: 'Docs',
  version: '0.2.0',
  coreApi: '^0.1.0',
  defaultAccess: 'teams',
  changelog: await loadChangelogFolder(new URL('./changelog/', import.meta.url)),
  register(ctx) {
    ctx.navigation.add({ id: 'docs.home', label: 'Docs', path: '/docs', placement: 'top' });
    ctx.navigation.add({
      id: 'docs.create-page',
      label: 'Page',
      path: '/docs/create',
      placement: 'create',
    });
    ctx.navigation.add({
      id: 'docs.create-space',
      label: 'Space',
      path: '/docs/spaces/new',
      placement: 'create',
    });
    for (const capability of DOCS_CAPABILITIES) ctx.capabilities.add(capability);
    defineDocsSettings(ctx.settings);
    const services = createDocsServices({
      realtime: ctx.realtime,
      events: ctx.events,
      collab: ctx.collab,
      jobs: ctx.jobs,
      settings: ctx.settings,
      entities: ctx.entities,
      ...(ctx.database ? { database: ctx.database } : {}),
      ...(ctx.audit ? { audit: ctx.audit } : {}),
      ...(ctx.memberships ? { memberships: ctx.memberships } : {}),
    });
    ctx.collab.add(services.collab.definition);
    ctx.jobs.add(compactJob(services.collab));
    registerDocsSearch(ctx.search, services.search);
    registerDocsReferences(ctx, services.links);
    ctx.routes.add({ prefix: '/docs', plugin: docsRoutes(createDocsControllers(services)) });
  },
});

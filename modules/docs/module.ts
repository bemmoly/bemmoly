import { defineModule, loadChangelogFolder } from '@bemmoly/core';
import { DOCS_CAPABILITIES } from './server/src/config/capabilities.ts';
import { defineDocsSettings } from './server/src/config/settings.ts';

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
  },
});

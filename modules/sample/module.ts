import { defineModule } from '@bemmoly/core';

/** Throwaway module that proves the contract end to end; it owns no data yet. */
export default defineModule({
  id: 'sample',
  version: '0.0.0',
  coreApi: '^0.1.0',
  defaultAccess: 'everyone',
  changelog: [],
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
  },
});

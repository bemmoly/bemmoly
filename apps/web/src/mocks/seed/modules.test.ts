import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';

/* A fresh mock install enables nothing; the seeded workspace has Work on, as an admin left it. */

const enabled = (api: ReturnType<typeof createMockApi>) =>
  api.db.adminModules.filter((module) => module.enabled).map((module) => module.id);

describe('the mock module seed', () => {
  it('starts a fresh install with every module off and no grants', () => {
    const api = createMockApi('fresh');
    expect(api.db.adminModules.map((module) => module.id)).toEqual(['sample', 'work']);
    expect(enabled(api)).toEqual([]);
    expect(api.db.manifests).toEqual([]);
    expect(api.db.grants).toEqual([]);
  });

  it('seeds the demo workspace with Work enabled for the Platform team', () => {
    const api = createMockApi('ready');
    expect(enabled(api)).toEqual(['sample', 'work']);
    const work = api.db.manifests.find((manifest) => manifest.id === 'work');
    expect(work?.name).toBe('Work');
    expect(
      work?.navigation.filter((nav) => nav.placement === 'top').map((nav) => nav.label),
    ).toEqual(['Board', 'Backlog', 'Projects']);
    expect(api.db.grants.filter((grant) => grant.moduleId === 'work')).toMatchObject([
      { subjectKind: 'team' },
    ]);
  });

  it('gives an enabled module its own navigation, as the server does', () => {
    const api = createMockApi('wizard');
    api.db.adminModules.forEach((module) => (module.enabled = false));
    api.db.manifests = [];
    const answer = api.dispatch('POST', '/api/v1/admin/modules/work/enable', {
      access: { mode: 'everyone' },
    });
    expect(answer?.status).toBe(200);
    const work = api.db.manifests.find((manifest) => manifest.id === 'work');
    expect(work?.navigation.map((nav) => nav.path)).toContain('/work/backlog');
  });
});

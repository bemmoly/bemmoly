import { describe, expect, it, vi } from 'vitest';
import type { EntityDefinition, EntityLookup } from '../../modules/registries.ts';
import type { FromModule } from '../../modules/registry.ts';
import { createLinkPreviews } from './index.ts';

const issue: FromModule<EntityDefinition> = {
  moduleId: 'work',
  kind: 'issue',
  renderer: 'work.issue',
  fromPath: (path) => (path.startsWith('/work/issue/') ? { key: path.slice(12) } : null),
  resolve: async (ref: EntityLookup) =>
    'key' in ref && ref.key === 'PLT-204'
      ? { kind: 'issue', id: 'i1', key: 'PLT-204', title: 'Fix login', path: '/work/issue/PLT-204' }
      : null,
  canView: async () => true,
};

const page: FromModule<EntityDefinition> = {
  moduleId: 'docs',
  kind: 'page',
  renderer: 'docs.page',
  fromPath: (path) => (path.startsWith('/docs/p/') ? { id: path.slice(8) } : null),
  resolve: async () => ({ kind: 'page', id: 'p1', title: ' ', path: '/docs/p/p1' }),
  canView: async () => true,
};

function previews({ on = true, enabled = ['work', 'docs'] } = {}) {
  const values: Record<string, unknown> = {
    'workspace.linkPreviews': on,
    'workspace.name': 'Acme Labs',
  };
  return createLinkPreviews({
    entities: () => [issue, page],
    isEnabled: (moduleId) => enabled.includes(moduleId),
    settings: { get: vi.fn(async (key: string) => values[key]) as never },
  });
}

describe('link previews', () => {
  it('names an issue by key and title, under the workspace', async () => {
    await expect(previews().forPath('/work/issue/PLT-204')).resolves.toEqual({
      title: 'PLT-204 Fix login',
      description: 'Issue in Acme Labs',
      siteName: 'Acme Labs',
    });
  });

  it('calls an untitled page Untitled', async () => {
    const preview = await previews().forPath('/docs/p/p1');
    expect(preview).toMatchObject({ title: 'Untitled', description: 'Page in Acme Labs' });
  });

  it('names nothing when an admin turned previews off', async () => {
    await expect(previews({ on: false }).forPath('/work/issue/PLT-204')).resolves.toBeNull();
  });

  it('names nothing for a missing record, an unknown path or a disabled module', async () => {
    await expect(previews().forPath('/work/issue/PLT-999')).resolves.toBeNull();
    await expect(previews().forPath('/work/board')).resolves.toBeNull();
    await expect(
      previews({ enabled: ['docs'] }).forPath('/work/issue/PLT-204'),
    ).resolves.toBeNull();
  });
});

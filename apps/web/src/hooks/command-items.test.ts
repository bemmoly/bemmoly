import type { ModuleManifest } from '@bemmoly/shared';
import { describe, expect, it, vi } from 'vitest';
import { seedUsers } from '../mocks/seed/people.ts';
import { paletteItems, paletteScopes, type PaletteSources } from './command-items.ts';

const work: ModuleManifest = {
  id: 'work',
  version: '0.2.0',
  navigation: [
    { id: 'projects', label: 'Projects', path: '/work', placement: 'top' },
    { id: 'issue', label: 'Issue', path: '/work/issues/new', placement: 'create' },
  ],
};

const sources = (patch: Partial<PaletteSources> = {}): PaletteSources => ({
  viewer: { isAdmin: false, capabilities: [] },
  canManagePeople: false,
  modules: [work],
  users: [],
  searchHits: [],
  run: { invite: vi.fn(), inbox: vi.fn(), mode: vi.fn(), signOut: vi.fn() },
  ...patch,
});

const titles = (items: ReturnType<typeof paletteItems>, group: string) =>
  items.filter((item) => item.group === group).map((item) => item.title);

describe('paletteItems', () => {
  it('offers members only their own settings and no people actions', () => {
    const items = paletteItems(sources());
    expect(titles(items, 'Settings')).toEqual(['Notifications']);
    expect(titles(items, 'Actions')).toContain('Create issue');
    expect(titles(items, 'Actions')).not.toContain('Invite people');
    expect(titles(items, 'Actions')).toContain('Go to Projects');
  });

  it('gives people managers the directory, search hits without duplicates, and invite', () => {
    const users = seedUsers();
    const rohan = users[0];
    if (!rohan) throw new Error('seed missing');
    const items = paletteItems(
      sources({
        viewer: { isAdmin: true, capabilities: [] },
        canManagePeople: true,
        users,
        searchHits: [
          { kind: 'user', id: rohan.id, title: rohan.name, subtitle: rohan.email, href: '/x' },
          {
            kind: 'user',
            id: 'beyond-200',
            title: 'Zoe Q.',
            subtitle: null,
            href: '/settings/users',
          },
        ],
      }),
    );
    const people = titles(items, 'People');
    expect(people).toHaveLength(users.length + 1);
    expect(people).toContain('Zoe Q.');
    expect(titles(items, 'Actions')).toEqual(
      expect.arrayContaining(['Invite people', 'Create team']),
    );
    expect(titles(items, 'Settings')).toContain('Storage and backups');
  });
  it('puts what module providers found first, under their group, with the key', () => {
    const items = paletteItems(
      sources({
        searchHits: [
          {
            kind: 'work.issue',
            id: 'i1',
            key: 'PLT-204',
            title: 'Session store migration',
            subtitle: 'In review',
            href: '/work/issue/PLT-204',
            group: 'Issues',
          },
        ],
      }),
    );
    expect(items[0]).toMatchObject({
      group: 'Issues',
      issueKey: 'PLT-204',
      title: 'Session store migration',
      href: '/work/issue/PLT-204',
      fromServer: true,
    });
    expect(titles(items, 'People')).toEqual([]);
  });

  it('offers a scope per module search group between All and People', () => {
    const scopes = paletteScopes([{ ...work, search: [{ kind: 'work.issue', label: 'Issues' }] }]);
    expect(scopes.map((scope) => scope.label)).toEqual([
      'All',
      'Issues',
      'People',
      'Settings',
      'Actions',
    ]);
    expect(scopes[1]).toEqual({ value: 'work.issue', label: 'Issues', group: 'Issues' });
  });
});

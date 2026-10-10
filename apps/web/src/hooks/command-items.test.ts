import type { ModuleManifest } from '@bemmoly/shared';
import { describe, expect, it, vi } from 'vitest';
import { seedUsers } from '../mocks/seed/people.ts';
import { paletteItems, paletteScopes, recentItem, type PaletteSources } from './command-items.ts';

const work: ModuleManifest = {
  id: 'work',
  version: '0.2.0',
  icon: 'board',
  navigation: [
    { id: 'work.home', label: 'Work', path: '/work/board', placement: 'top' },
    {
      id: 'work.backlog',
      label: 'Backlog',
      path: '/work/backlog',
      placement: 'command',
      icon: 'backlog',
      keys: 'G L',
    },
    { id: 'issue', label: 'Issue', path: '/work/issues/new', placement: 'create', icon: 'check' },
  ],
};

const sources = (patch: Partial<PaletteSources> = {}): PaletteSources => ({
  viewer: { isAdmin: false, capabilities: [] },
  canManagePeople: false,
  modules: [work],
  users: [],
  searchHits: [],
  creates: [{ id: 'work.create-issue', label: 'Issue', icon: 'check', open: vi.fn() }],
  run: { invite: vi.fn(), shortcuts: vi.fn(), mode: vi.fn(), signOut: vi.fn() },
  ...patch,
});

const titles = (items: ReturnType<typeof paletteItems>, group: string) =>
  items.filter((item) => item.group === group).map((item) => item.title);

describe('paletteItems', () => {
  it('offers members only their own settings, creating with C, and no people actions', () => {
    const items = paletteItems(sources());
    expect(titles(items, 'Settings')).toEqual(['Profile', 'Notifications']);
    const create = items.find((item) => item.title === 'New issue');
    expect(create).toMatchObject({ group: 'Actions', keys: 'C', icon: 'check' });
    expect(titles(items, 'Actions')).not.toContain('Invite people');
    expect(titles(items, 'Navigation')).toEqual(['Home', 'Inbox', 'Backlog', 'Settings']);
    expect(items.find((item) => item.title === 'Backlog')).toMatchObject({
      icon: 'backlog',
      keys: 'G L',
    });
  });

  it('puts the screen’s own actions first, each with its own icon', () => {
    const run = vi.fn();
    const items = paletteItems(
      sources({
        screenActions: [
          { id: 'assign', title: 'Assign PLT-204 to me', look: { kind: 'icon', icon: 'me' }, run },
        ],
      }),
    );
    const actions = items.filter((item) => item.group === 'Actions');
    expect(actions[0]).toMatchObject({ title: 'Assign PLT-204 to me', look: { icon: 'me' } });
    actions[0]?.run?.();
    expect(run).toHaveBeenCalledOnce();
    expect(items.every((item) => item.icon || item.look || item.person)).toBe(true);
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
    expect(titles(items, 'Actions')).toEqual(expect.arrayContaining(['Invite people', 'New team']));
    expect(titles(items, 'Settings')).toContain('Storage and backups');
  });

  it('puts what module providers found first, with the key, type and status', () => {
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
            look: {
              type: { key: 'story', icon: null, color: null, level: 'standard' },
              status: { category: 'in_progress', name: 'In review' },
            },
          },
        ],
      }),
    );
    expect(items[0]).toMatchObject({
      group: 'Issues',
      issueKey: 'PLT-204',
      href: '/work/issue/PLT-204',
      fromServer: true,
      look: { kind: 'issue', type: { key: 'story' }, status: { name: 'In review' } },
    });
  });

  it('keeps a recent item’s own type, so a type filter still finds it', () => {
    const recent = recentItem({
      id: 'work.issue:PLT-204',
      title: 'Session store migration',
      handle: 'PLT-204',
      path: '/work/issue/PLT-204',
      look: { kind: 'icon', icon: 'doc' },
      group: 'Issues',
      openedAt: '2026-10-10T09:00:00.000Z',
    });
    expect(recent).toMatchObject({ group: 'Recent', kindGroup: 'Issues', issueKey: 'PLT-204' });
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
  });
});

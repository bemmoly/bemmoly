import type { ModuleManifest } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { groupItems, rankItems, type CommandItem } from './command/rank.ts';
import { formatBytes, formatRelative, initials } from './format.ts';
import { actorLabel } from './inbox/group.ts';
import { buildSettingsNav, flattenSettings } from './settings/sections.ts';

const items: CommandItem[] = [
  { id: 'users', group: 'Settings', title: 'Users', href: '/settings/users' },
  {
    id: 'email',
    group: 'Settings',
    title: 'Email and notifications',
    keywords: ['smtp'],
    href: '/e',
  },
  { id: 'rohan', group: 'People', title: 'Rohan S.', subtitle: 'rohan@acme.dev', href: '/u/1' },
];

describe('command ranking', () => {
  it('ranks prefix matches first and matches keywords and fuzzy input', () => {
    expect(rankItems('us', items).map((item) => item.id)).toEqual(['users']);
    expect(rankItems('smtp', items).map((item) => item.id)).toEqual(['email']);
    expect(rankItems('rhn', items).map((item) => item.id)).toEqual(['rohan']);
    expect(rankItems('', items)).toHaveLength(3);
    expect(groupItems(items).map((group) => group.name)).toEqual(['Settings', 'People']);
  });
});

describe('settings navigation', () => {
  const work: ModuleManifest = {
    id: 'work',
    version: '0.1.0',
    navigation: [
      { id: 'projects', label: 'Projects', path: '/work', placement: 'top' },
      {
        id: 'workflows',
        label: 'Workflows',
        path: '/settings/work/workflows',
        placement: 'settings',
      },
    ],
  };

  it('gives admins every group with module groups before System', () => {
    const groups = buildSettingsNav([work], { isAdmin: true, capabilities: [] }, { users: 42 });
    expect(groups.map((group) => group.label)).toEqual([
      'Personal',
      'General',
      'People',
      'Projects',
      'System',
    ]);
    expect(flattenSettings(groups).find((item) => item.id === 'users')?.count).toBe(42);
  });

  it('shows members only their own pages and what their capabilities allow', () => {
    const groups = buildSettingsNav([work], {
      isAdmin: false,
      capabilities: ['workspace.appearance.manage'],
    });
    expect(flattenSettings(groups).map((item) => item.id)).toEqual(['notifications', 'appearance']);
  });
});

describe('inbox wording', () => {
  it('names the actors the server grouped', () => {
    expect(actorLabel(['Aisha K.'], 1)).toBe('Aisha K.');
    expect(actorLabel(['Aisha K.', 'Jonas M.'], 2)).toBe('Aisha K. and Jonas M.');
    expect(actorLabel(['Aisha K.', 'Jonas M.'], 3)).toBe('Aisha K. and 2 others');
    expect(actorLabel([], 0)).toBe('Bemmoly');
  });
});

describe('formatting', () => {
  const now = new Date('2026-10-07T12:00:00');
  it('renders relative times like the mocks', () => {
    expect(formatRelative(null, now)).toBe('Never');
    expect(formatRelative('2026-10-07T11:59:30', now)).toBe('now');
    expect(formatRelative('2026-10-07T09:00:00', now)).toBe('3h ago');
    expect(formatRelative('2026-10-06T09:00:00', now)).toBe('yesterday');
    expect(formatRelative('2026-10-02T09:00:00', now)).toBe('Friday');
    expect(formatRelative('2026-09-25T09:00:00', now)).toBe('12 days ago');
  });

  it('builds initials and byte sizes', () => {
    expect(initials('Rohan S.')).toBe('RS');
    expect(initials('priya@acme.dev')).toBe('P');
    expect(formatBytes(38_000_000_000)).toBe('38 GB');
    expect(formatBytes(1_400_000_000)).toBe('1.4 GB');
  });
});

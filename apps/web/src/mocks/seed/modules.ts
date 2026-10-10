import type { AdminModule, ModuleGrant, ModuleManifest } from '@bemmoly/shared';
import { TEAM_IDS, USER_IDS } from './people.ts';
import { ago, uid } from './time.ts';

/*
 * The modules this mock install ships, as the server would list them. A
 * fresh install enables none; the seeded workspace is what an admin leaves
 * behind after enabling Sample for everyone and Work for the Platform team.
 */

interface Shipped {
  admin: Omit<AdminModule, 'enabled' | 'enabledAt' | 'versionInstalled' | 'changelogState'>;
  /** The navigation and look the module registers, mirrored from its module.ts. */
  manifest: ModuleManifest;
  /** Minutes before now the seeded admin enabled it. */
  enabledMinutesAgo: number;
}

const SHIPPED: Shipped[] = [
  {
    admin: {
      id: 'sample',
      name: 'Sample',
      version: '0.1.0',
      pendingChangesets: 1,
      dependsOn: [],
      defaultAccess: 'none',
      restartRequired: false,
    },
    manifest: {
      id: 'sample',
      name: 'Sample',
      version: '0.1.0',
      navigation: [{ id: 'sample', label: 'Sample', path: '/sample', placement: 'top' }],
      icon: 'box',
      color: 'epic-4',
      order: 90,
      sidebar: { path: '/sample', links: [], primary: [] },
    },
    enabledMinutesAgo: 60 * 24 * 9,
  },
  {
    admin: {
      id: 'work',
      name: 'Work',
      version: '0.2.0',
      pendingChangesets: 21,
      dependsOn: [],
      defaultAccess: 'teams',
      restartRequired: false,
    },
    manifest: {
      id: 'work',
      name: 'Work',
      version: '0.2.0',
      navigation: [
        { id: 'work.home', label: 'Work', path: '/work/board', placement: 'top' },
        {
          id: 'work.board',
          label: 'Board',
          path: '/work/board',
          placement: 'command',
          keys: 'G B',
        },
        {
          id: 'work.backlog',
          label: 'Backlog',
          path: '/work/backlog',
          placement: 'command',
          keys: 'G L',
        },
        { id: 'work.projects', label: 'Projects', path: '/work/projects', placement: 'command' },
        { id: 'work.create-issue', label: 'Issue', path: '/work/create', placement: 'create' },
        {
          id: 'work.create-project',
          label: 'Project',
          path: '/work/projects/new',
          placement: 'create',
        },
      ],
      search: [{ kind: 'work.issue', label: 'Issues' }],
      icon: 'board',
      color: 'brand-1',
      order: 10,
      sidebar: {
        path: '/work/projects',
        links: [
          {
            id: 'work.all-projects',
            label: 'All projects',
            path: '/work/projects',
            icon: 'layers',
          },
        ],
        primary: [
          { id: 'work.my-issues', label: 'My issues', path: '/work/my-issues', icon: 'me' },
        ],
        add: { create: 'work.create-project', label: 'New project' },
      },
    },
    enabledMinutesAgo: 60 * 24 * 3,
  },
  {
    admin: {
      id: 'docs',
      name: 'Docs',
      version: '0.2.0',
      pendingChangesets: 12,
      dependsOn: [],
      defaultAccess: 'teams',
      restartRequired: false,
    },
    manifest: {
      id: 'docs',
      name: 'Docs',
      version: '0.2.0',
      navigation: [
        { id: 'docs.home', label: 'Docs', path: '/docs', placement: 'top' },
        { id: 'docs.create-page', label: 'Page', path: '/docs/create', placement: 'create' },
        {
          id: 'docs.create-space',
          label: 'Space',
          path: '/docs/spaces/new',
          placement: 'create',
        },
      ],
      search: [{ kind: 'docs.page', label: 'Pages' }],
      icon: 'doc',
      color: 'brand-2',
      order: 20,
      sidebar: {
        path: '/docs',
        links: [],
        primary: [],
        add: { create: 'docs.create-space', label: 'New space' },
      },
    },
    enabledMinutesAgo: 60 * 24 * 2,
  },
];

/** The manifest a module serves once enabled, or null when this install does not ship it. */
export function shippedManifest(id: string): ModuleManifest | null {
  const found = SHIPPED.find((entry) => entry.admin.id === id);
  return found ? structuredClone(found.manifest) : null;
}

/** Settings › Modules rows: every shipped module, enabled in the seeded workspace. */
export function seedAdminModules(enabled = true): AdminModule[] {
  return SHIPPED.map(({ admin, enabledMinutesAgo }) => ({
    ...admin,
    enabled,
    enabledAt: enabled ? ago(enabledMinutesAgo) : null,
    versionInstalled: enabled ? admin.version : null,
    changelogState: enabled ? 'current' : 'pending',
    pendingChangesets: enabled ? 0 : admin.pendingChangesets,
  }));
}

/** What the shell loads: the enabled modules' manifests. */
export function seedManifests(enabled = true): ModuleManifest[] {
  return enabled ? SHIPPED.map((entry) => structuredClone(entry.manifest)) : [];
}

/** The access the seeded admin chose when enabling each module. */
export function seedGrants(): ModuleGrant[] {
  return [
    {
      id: uid(60),
      moduleId: 'sample',
      subjectKind: 'everyone',
      subjectId: null,
      grantedBy: USER_IDS.rohan,
      createdAt: ago(60 * 24 * 3),
    },
    {
      id: uid(61),
      moduleId: 'work',
      subjectKind: 'team',
      subjectId: TEAM_IDS.platform,
      grantedBy: USER_IDS.rohan,
      createdAt: ago(60 * 24 * 3),
    },
    {
      id: uid(62),
      moduleId: 'docs',
      subjectKind: 'everyone',
      subjectId: null,
      grantedBy: USER_IDS.rohan,
      createdAt: ago(60 * 24 * 2),
    },
  ];
}

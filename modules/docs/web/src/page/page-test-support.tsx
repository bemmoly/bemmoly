import { queryKeys } from '@bemmoly/api-client';
import { render } from '@testing-library/react';
import type { CollabPage } from '../collab/use-collab-page.ts';
import { collabUser } from '../collab/user.ts';
import { docsKeys } from '../shared/keys.ts';
import { id, newClient, providers, SPACE_ID } from '../test-support.tsx';
import PageScreen from './page-screen.tsx';

/*
 * The page screen's test bench: a page detail as the server sends it, the people, a session
 * that may publish, and a live-document state the test sets (the collaboration socket itself
 * is covered by the collab tests and the two-browser end-to-end flow).
 */

const at = '2026-09-12T10:00:00.000Z';

export const PAGE_ID = id(7001);
export const PARENT_ID = id(7002);
export const PRIYA = id(7101);
export const JONAS = id(7102);
export const ROHAN = id(7103);

const user = (userId: string, name: string, email: string) => ({
  id: userId,
  email,
  name,
  avatarKey: null,
  status: 'active',
  isBreakGlass: false,
  roleId: id(7900),
  teamIds: [],
  themePref: null,
  locale: null,
  timezone: null,
  lastSeenAt: null,
  createdAt: at,
});

export const PEOPLE = [
  user(PRIYA, 'Priya N.', 'priya@acme.test'),
  user(JONAS, 'Jonas M.', 'jonas@acme.test'),
  user(ROHAN, 'Rohan S.', 'rohan@acme.test'),
];

/** GET /spaces/ENG/members: everyone may review but Sam, who is only invited. */
export const MEMBERS = {
  items: [
    ...PEOPLE.map((person) => ({
      userId: person.id,
      name: person.name,
      email: person.email,
      status: 'active',
      roleId: id(7901),
      roleKey: 'member',
      roleName: 'Member',
      access: 'member',
      canReview: true,
      addedAt: at,
    })),
    {
      userId: id(7104),
      name: 'Sam R.',
      email: 'sam@acme.test',
      status: 'invited',
      roleId: id(7901),
      roleKey: 'member',
      roleName: 'Member',
      access: 'member',
      canReview: false,
      addedAt: at,
    },
  ],
  roles: [{ id: id(7901), key: 'member', name: 'Member' }],
  canManage: true,
};

export function pageDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: PAGE_ID,
    spaceId: SPACE_ID,
    spaceKey: 'ENG',
    parentId: PARENT_ID,
    position: 'n',
    depth: 1,
    title: 'Auth service RFC',
    icon: null,
    status: 'draft',
    ownerId: PRIYA,
    hasChildren: false,
    wordCount: 240,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    snapshot: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Context' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Sessions move to Postgres.' }] },
      ],
    },
    cover: null,
    tldr: null,
    reviewers: [],
    templateId: null,
    labels: ['rfc'],
    starred: false,
    version: 3,
    breadcrumbs: [{ id: PARENT_ID, title: 'Architecture', icon: null }],
    owner: { id: PRIYA, name: 'Priya N.' },
    createdBy: PRIYA,
    updatedBy: JONAS,
    publishedAt: null,
    contentUpdatedAt: at,
    ...overrides,
  };
}

export const priyaPeer = collabUser({ id: PRIYA, name: 'Priya Nair', email: 'priya@acme.test' });

export function collabState(patch: Partial<CollabPage> = {}): CollabPage {
  return {
    status: 'live',
    editable: true,
    unsynced: 0,
    peers: [],
    doc: null,
    extensions: null,
    editorKey: 'test',
    ...patch,
  };
}

/** Renders /docs/p/:pageId as the shell would, signed in as Rohan with publish rights. */
export function renderPage({ capabilities = ['docs.page.publish'], aiEnabled = false } = {}) {
  const client = newClient();
  client.setQueryData(queryKeys.me(), {
    user: PEOPLE[2],
    workspace: { name: 'Acme', aiEnabled },
    capabilities,
    modules: ['docs'],
  });
  client.setQueryData(docsKeys.people(), { items: PEOPLE, nextCursor: null });
  render(<PageScreen segment={PAGE_ID} rest={[]} screen="p" />, { wrapper: providers(client) });
  return client;
}

import { ToastProvider } from '@bemmoly/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup } from '@testing-library/react';
import { http, HttpResponse, type HttpHandler } from 'msw';
import { setupServer } from 'msw/node';
import { useState, type ReactNode } from 'react';
import { afterAll, afterEach, beforeAll } from 'vitest';

/*
 * The Issue tests' backend: MSW answering the server's routes with rows in the shared
 * schemas' shapes. Anything a test does not answer is a 404, as an unknown route is.
 */

export const id = (n: number) => `018f0000-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;
const at = '2026-10-01T10:00:00.000Z';

export const IDS = {
  project: id(1),
  story: id(2),
  epic: id(3),
  review: id(4),
  testing: id(5),
  issue: id(6),
  rohan: id(7),
  aisha: id(8),
  criteria: id(9),
  severity: id(10),
  role: id(11),
} as const;

export const project = {
  id: IDS.project,
  key: 'PLT',
  name: 'Platform Core',
  description: null,
  teamId: null,
  method: 'scrum',
  schemeOverrides: {},
  defaultSpaceId: null,
  archivedAt: null,
  createdAt: at,
  updatedAt: at,
};

const type = (typeId: string, key: string, name: string, level: string, position: number) => ({
  id: typeId,
  projectId: null,
  originId: null,
  key,
  name,
  description: null,
  icon: null,
  color: null,
  level,
  position,
  createdAt: at,
  updatedAt: at,
});

export const types = [
  type(IDS.epic, 'epic', 'Epic', 'epic', 0),
  type(IDS.story, 'story', 'Story', 'standard', 1),
];

const field = (fieldId: string, key: string, name: string, kind: string) => ({
  id: fieldId,
  projectId: null,
  originId: null,
  key,
  name,
  kind,
  options: [],
  filterable: false,
  aiFill: false,
  createdAt: at,
  updatedAt: at,
});

export const fields = [
  field(IDS.criteria, 'acceptance_criteria', 'Acceptance criteria', 'richtext'),
  field(IDS.severity, 'severity', 'Severity', 'text'),
];

export const user = (userId: string, name: string) => ({
  id: userId,
  email: `${name.split(' ')[0]?.toLowerCase()}@acme.test`,
  name,
  avatarKey: null,
  status: 'active',
  isBreakGlass: false,
  roleId: IDS.role,
  teamIds: [],
  themePref: null,
  locale: null,
  timezone: null,
  lastSeenAt: at,
  createdAt: at,
});

export const issue = {
  id: IDS.issue,
  projectId: IDS.project,
  number: 204,
  key: 'PLT-204',
  typeId: IDS.story,
  title: 'Session store migration to Postgres',
  description: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Move sessions.' }] }],
  },
  descriptionText: 'Move sessions.',
  statusId: IDS.review,
  priority: 'highest',
  assigneeId: IDS.aisha,
  reporterId: IDS.rohan,
  parentId: null,
  sprintId: null,
  estimate: 5,
  dueAt: null,
  fixVersionId: null,
  componentId: null,
  customFields: {},
  labelIds: [],
  rank: 'mb',
  statusChangedAt: at,
  resolvedAt: null,
  deletedAt: null,
  createdAt: at,
  updatedAt: at,
  type: { id: IDS.story, name: 'Story', key: 'story', level: 'standard', icon: null },
  status: { id: IDS.review, name: 'Code review', category: 'in_progress', color: null },
  assignee: { id: IDS.aisha, name: 'Aisha K.', email: 'aisha@acme.test' },
  reporter: { id: IDS.rohan, name: 'Rohan S.', email: 'rohan@acme.test' },
  parent: null,
  sprint: null,
  fixVersion: null,
  labels: [],
  links: [],
  subtasks: [],
  watchersCount: 2,
  watching: false,
};

const empty = { items: [], nextCursor: null };

/** The signed-in person (Rohan), with AI on or off for the workspace. */
export const me = (aiEnabled: boolean) => ({
  user: user(IDS.rohan, 'Rohan S.'),
  capabilities: [],
  modules: ['work'],
  workspace: {
    name: 'Acme',
    url: 'http://bemmoly.test',
    aiEnabled,
    appearance: {
      theme: 'classic',
      brandColor: '#2356C9',
      font: 'inter',
      logoKey: '',
      mode: 'light',
      surfaces: 'neutral',
      memberModeSwitch: true,
      personalThemes: true,
    },
  },
});

/** The routes every Issue screen reads; tests add or replace handlers for their case. */
export const baseHandlers: HttpHandler[] = [
  http.get('*/api/v1/me', () => HttpResponse.json(me(false))),
  http.get('*/api/v1/users', () =>
    HttpResponse.json({
      items: [user(IDS.rohan, 'Rohan S.'), user(IDS.aisha, 'Aisha K.')],
      nextCursor: null,
    }),
  ),
  http.get('*/api/v1/work/projects', () =>
    HttpResponse.json({ items: [project], nextCursor: null }),
  ),
  http.get('*/api/v1/work/projects/PLT/issue-types', () => HttpResponse.json({ items: types })),
  http.get('*/api/v1/work/projects/PLT/fields', () => HttpResponse.json({ items: fields })),
  http.get('*/api/v1/work/projects/PLT/issue-types/:typeId/fields', ({ params }) =>
    HttpResponse.json({
      items:
        params['typeId'] === IDS.story
          ? [
              {
                id: id(50),
                issueTypeId: IDS.story,
                fieldId: IDS.criteria,
                required: true,
                onCard: false,
                position: 0,
              },
              {
                id: id(51),
                issueTypeId: IDS.story,
                fieldId: IDS.severity,
                required: false,
                onCard: false,
                position: 1,
              },
            ]
          : [],
    }),
  ),
  http.get('*/api/v1/work/workflows', () => HttpResponse.json({ items: [] })),
  http.get('*/api/v1/work/issues/PLT-204', () => HttpResponse.json(issue)),
  http.get('*/api/v1/work/issues', () => HttpResponse.json(empty)),
  http.get('*/api/v1/work/issues/PLT-204/comments', () => HttpResponse.json(empty)),
  http.get('*/api/v1/work/issues/PLT-204/history', () => HttpResponse.json(empty)),
  http.get('*/api/v1/work/issues/PLT-204/work-logs', () => HttpResponse.json({ items: [] })),
  http.get('*/api/v1/work/issues/PLT-204/watchers', () => HttpResponse.json({ items: [] })),
  http.all('*/api/v1/*', ({ request }) =>
    HttpResponse.json(
      { code: 'not_found', message: `No route for ${request.method}`, requestId: 'test' },
      { status: 404 },
    ),
  ),
];

/** Starts MSW for one test file; `server.use` adds a test's own handlers in front. */
export function startServer() {
  const server = setupServer(...baseHandlers);
  beforeAll(() => {
    (window as { happyDOM?: { setURL(url: string): void } }).happyDOM?.setURL(
      'http://bemmoly.test/',
    );
    server.listen({ onUnhandledFrame: 'bypass' });
  });
  afterEach(() => {
    cleanup();
    server.resetHandlers();
  });
  afterAll(() => server.close());
  return server;
}

/** A fresh query cache and the toast stack, as the shell gives a module chunk. */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

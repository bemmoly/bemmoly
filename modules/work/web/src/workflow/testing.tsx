import { ToastProvider } from '@bemmoly/ui';
import { cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import type { Workflow, WorkflowRuleDefinition } from '../../../shared/index.ts';
import type { EditorDraft } from './draft-model.ts';

/*
 * A small in-memory workflow backend for the editor's tests, answering the
 * routes of modules/work/server/src/routes/workflow.routes.ts in the
 * server's shapes, and recording every draft the editor saves.
 */

const ORIGIN = 'http://bemmoly.test';
const API = `${ORIGIN}/api/v1/work`;
export const WORKFLOW_ID = '018f0000-0000-7000-8000-000000000904';
export const PROJECT_ID = '018f0000-0000-7000-8000-000000000900';
const STAMP = '2026-10-01T10:00:00.000Z';
const sid = (n: number) => `018f0000-0000-7000-8000-00000000092${n}`;
export const STATUS = { backlog: sid(0), progress: sid(1), done: sid(2) } as const;

const object = (properties: Record<string, unknown> = {}, required: string[] = []) => ({
  type: 'object',
  properties,
  ...(required.length > 0 ? { required } : {}),
});

export const RULES: WorkflowRuleDefinition[] = [
  {
    name: 'field_set',
    kind: 'condition',
    label: 'Field is set',
    description: 'The issue has a value in the named field',
    params: object({ field: { type: 'string', minLength: 1 } }, ['field']),
    available: true,
  },
  {
    name: 'comment_required',
    kind: 'validator',
    label: 'Comment required',
    description: 'The move must carry a comment',
    params: object({ minLength: { type: 'integer', default: 1, minimum: 1 } }),
    available: true,
  },
  {
    name: 'clear_sprint',
    kind: 'post_action',
    label: 'Clear sprint',
    description: 'Removes the issue from its sprint',
    params: object(),
    available: true,
  },
];

function published(): Workflow {
  const status = (id: string, name: string, category: string, position: number) => ({
    id,
    workflowId: WORKFLOW_ID,
    name,
    category: category as Workflow['statuses'][number]['category'],
    color: null,
    position,
    allowedRoleIds: [],
  });
  return {
    id: WORKFLOW_ID,
    projectId: PROJECT_ID,
    originId: null,
    name: 'Software workflow',
    publishedVersion: 3,
    publishedAt: STAMP,
    hasDraft: false,
    statuses: [
      status(STATUS.backlog, 'Backlog', 'todo', 0),
      status(STATUS.progress, 'In progress', 'in_progress', 1),
      status(STATUS.done, 'Done', 'done', 2),
    ],
    transitions: [
      {
        id: '018f0000-0000-7000-8000-000000000940',
        workflowId: WORKFLOW_ID,
        fromStatusId: STATUS.backlog,
        toStatusId: STATUS.progress,
        name: 'Start work',
        rules: { conditions: [], validators: [], postActions: [] },
        position: 0,
      },
    ],
    createdAt: STAMP,
    updatedAt: STAMP,
  };
}

export interface WorkflowBackend {
  workflow: Workflow;
  draft: EditorDraft | null;
  saved: EditorDraft[];
  validations: number;
  /** Set to make the next validate or publish answer these. */
  problems: Array<{ code: string; message: string; statusId?: string; transitionId?: string }>;
  mappingRequired: Array<{ statusId: string; name: string; issues: number }>;
}

export const backend: WorkflowBackend = {
  workflow: published(),
  draft: null,
  saved: [],
  validations: 0,
  problems: [],
  mappingRequired: [],
};

function draftOf(): EditorDraft {
  if (backend.draft) return backend.draft;
  const { statuses, transitions } = backend.workflow;
  return {
    statuses: statuses.map(({ workflowId: _, color: __, x, y, ...status }) => ({
      ...status,
      ...(x != null ? { x } : {}),
      ...(y != null ? { y } : {}),
    })),
    transitions: transitions.map(({ workflowId: _, ...transition }) => transition),
  };
}

export const server = setupServer(
  http.get(`${API}/workflows/:id`, () => HttpResponse.json(backend.workflow)),
  http.get(`${API}/workflows`, () => HttpResponse.json({ items: [backend.workflow] })),
  http.get(`${API}/workflows/:id/draft`, () => HttpResponse.json({ draft: draftOf() })),
  http.put(`${API}/workflows/:id/draft`, async ({ request }) => {
    const { draft } = (await request.json()) as { draft: EditorDraft };
    backend.draft = draft;
    backend.saved.push(draft);
    backend.workflow = { ...backend.workflow, hasDraft: true };
    return HttpResponse.json({ draft });
  }),
  http.post(`${API}/workflows/:id/validate`, () => {
    backend.validations += 1;
    return HttpResponse.json({ valid: backend.problems.length === 0, problems: backend.problems });
  }),
  http.post(`${API}/workflows/:id/publish`, async ({ request }) => {
    const body = (await request.json()) as { statusMapping?: Record<string, string> };
    const unmapped = backend.mappingRequired.filter((s) => !body.statusMapping?.[s.statusId]);
    if (unmapped.length > 0)
      return HttpResponse.json(
        {
          code: 'validation_failed',
          message: 'Say where the issues in removed statuses should go',
          details: { statusMappingRequired: unmapped },
          requestId: 'test',
        },
        { status: 400 },
      );
    const placed = new Map((backend.draft?.statuses ?? []).map((status) => [status.id, status]));
    backend.workflow = {
      ...backend.workflow,
      publishedVersion: backend.workflow.publishedVersion + 1,
      publishedAt: new Date().toISOString(),
      hasDraft: false,
      statuses: backend.workflow.statuses.map((status) => ({
        ...status,
        x: placed.get(status.id)?.x ?? status.x ?? null,
        y: placed.get(status.id)?.y ?? status.y ?? null,
      })),
    };
    backend.draft = null;
    return HttpResponse.json(backend.workflow);
  }),
  http.get(`${API}/workflows/:id/status-counts`, () =>
    HttpResponse.json({ counts: { [STATUS.backlog]: 4, [STATUS.progress]: 2, [STATUS.done]: 9 } }),
  ),
  http.get(`${API}/workflow-rules`, () => HttpResponse.json({ items: RULES })),
  http.get(`${API}/projects`, () =>
    HttpResponse.json({
      items: [
        {
          id: PROJECT_ID,
          key: 'PLT',
          name: 'Platform Core',
          description: null,
          teamId: null,
          method: 'scrum',
          schemeOverrides: {},
          defaultSpaceId: null,
          archivedAt: null,
          createdAt: STAMP,
          updatedAt: STAMP,
        },
      ],
      nextCursor: null,
    }),
  ),
);

/** Starts the backend for a test file and resets it before every test. */
export function useWorkflowBackend(hooks: {
  beforeAll: (fn: () => void) => void;
  afterAll: (fn: () => void) => void;
  beforeEach: (fn: () => void) => void;
  afterEach: (fn: () => Promise<void>) => void;
}) {
  /** Unmounting saves what was waiting; let that save land before the next test resets. */
  hooks.afterEach(async () => {
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  hooks.beforeAll(() => {
    (window as { happyDOM?: { setURL(url: string): void } }).happyDOM?.setURL(`${ORIGIN}/`);
    server.listen({ onUnhandledFrame: 'error' });
  });
  hooks.beforeEach(() => {
    Object.assign(backend, {
      workflow: published(),
      draft: null,
      saved: [],
      validations: 0,
      problems: [],
      mappingRequired: [],
    });
  });
  hooks.afterAll(() => server.close());
}

export function testClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export function Providers({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

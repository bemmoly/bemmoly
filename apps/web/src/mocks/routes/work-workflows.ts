import { can, emit } from '../db.ts';
import { ago, newId, uid } from '../seed/time.ts';
import { bodyOf, fail, invalid, notFound, ok, page, type MockRoute } from '../types.ts';
import { validateDraft, type Draft, type DraftStatus } from './work-workflow-checks.ts';
import { PROJECT_CONFIGURE, touch, workState, type Row } from './work-state.ts';

const forbidden = () => fail(403, 'forbidden', 'You need "Configure project" to do that.');

/** Two more projects that inherit the org default workflow, so the list has someone to count. */
const INHERITING = [
  ['MOB', 'Mobile apps', 0x905],
  ['DAT', 'Data platform', 0x906],
] as const;

function projects(db: Parameters<typeof workState>[0]): Row[] {
  const state = workState(db);
  return [
    state.project,
    ...INHERITING.map(([key, name, n]) => ({
      ...state.project,
      id: uid(n),
      key,
      name,
      description: null,
      schemeOverrides: {},
      createdAt: ago(60 * 24 * 20),
    })),
  ];
}

/** The published statuses and transitions as an editor draft, when none is saved. */
function draftOf(workflow: Row): Draft {
  const draft = workflow['draft'] as Draft | null;
  if (draft) return draft;
  return {
    /** As the server's draftOf: no colour key when the status has none. */
    statuses: (workflow['statuses'] as DraftStatus[]).map(({ color, ...status }) => ({
      ...status,
      ...(color ? { color } : {}),
    })),
    transitions: (workflow['transitions'] as Draft['transitions']).map((transition) => ({
      ...transition,
    })),
  };
}

const findWorkflow = (db: Parameters<typeof workState>[0], id: string | undefined) =>
  workState(db).workflows.find((row) => row.id === id);

/** Issues in a removed status go where the body says; without a mapping the publish is refused. */
function retire(db: Parameters<typeof workState>[0], row: Row, draft: Draft, mapping: object) {
  const counts = workState(db).statusCounts;
  const kept = new Set(draft.statuses.map((status) => status.id));
  const targets = mapping as Record<string, string>;
  const removed = (row['statuses'] as DraftStatus[]).filter((status) => !kept.has(status.id));
  const unmapped = removed.filter(
    (status) => (counts[status.id] ?? 0) > 0 && !kept.has(targets[status.id] ?? ''),
  );
  if (unmapped.length > 0)
    return fail(400, 'validation_failed', 'Say where the issues in removed statuses should go', {
      statusMappingRequired: unmapped.map((status) => ({
        statusId: status.id,
        name: status.name,
        issues: counts[status.id] ?? 0,
      })),
    });
  for (const status of removed) {
    const target = targets[status.id];
    if (target) counts[target] = (counts[target] ?? 0) + (counts[status.id] ?? 0);
    delete counts[status.id];
  }
  return null;
}

function publish(db: Parameters<typeof workState>[0], row: Row, mapping: object) {
  const draft = row['draft'] as Draft | null;
  if (!draft) return invalid('draft', 'There is no draft to publish');
  const result = validateDraft(draft);
  if (!result.valid)
    return fail(400, 'validation_failed', 'The draft has problems', { problems: result.problems });
  const refused = retire(db, row, draft, mapping);
  if (refused) return refused;
  const ids = new Map(
    draft.statuses.map((status) => [status.id, status.id.includes('-') ? status.id : newId()]),
  );
  touch(row, {
    statuses: draft.statuses.map((status) => ({
      ...status,
      color: status['color'] ?? null,
      id: ids.get(status.id) ?? status.id,
      workflowId: row.id,
    })),
    transitions: draft.transitions.map((transition) => ({
      ...transition,
      id: transition.id.includes('-') ? transition.id : newId(),
      workflowId: row.id,
      fromStatusId: transition.fromStatusId
        ? (ids.get(transition.fromStatusId) ?? transition.fromStatusId)
        : null,
      toStatusId: ids.get(transition.toStatusId) ?? transition.toStatusId,
    })),
    draft: null,
    hasDraft: false,
    publishedVersion: Number(row['publishedVersion']) + 1,
    publishedAt: new Date().toISOString(),
  });
  emit(db, 'work.workflow', [row.id]);
  return ok(row);
}

export const workWorkflowRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/work/projects',
    handle: (request, db) => ok(page(projects(db), request)),
  },
  {
    method: 'GET',
    pattern: '/api/v1/work/workflows',
    handle: (request, db) => {
      const projectId = request.query.get('projectId');
      const rows = workState(db).workflows.filter(
        (row) => !projectId || row['projectId'] === null || row['projectId'] === projectId,
      );
      return ok({ items: rows });
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/work/workflow-rules',
    handle: (_, db) => ok({ items: workState(db).rules }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/work/workflows/:id',
    handle: (request, db) => {
      const row = findWorkflow(db, request.params['id']);
      return row ? ok(row) : notFound('Workflow');
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/work/workflows/:id/status-counts',
    handle: (request, db) =>
      findWorkflow(db, request.params['id'])
        ? ok({ counts: workState(db).statusCounts })
        : notFound('Workflow'),
  },
  {
    method: 'GET',
    pattern: '/api/v1/work/workflows/:id/draft',
    handle: (request, db) => {
      if (!can(db, PROJECT_CONFIGURE)) return forbidden();
      const row = findWorkflow(db, request.params['id']);
      return row ? ok({ draft: draftOf(row) }) : notFound('Workflow');
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/work/workflows/:id/draft',
    handle: (request, db) => {
      if (!can(db, PROJECT_CONFIGURE)) return forbidden();
      const row = findWorkflow(db, request.params['id']);
      if (!row) return notFound('Workflow');
      const draft = bodyOf<{ draft: Draft }>(request).draft;
      if (!draft?.statuses?.length)
        return invalid('draft.statuses', 'A workflow needs at least one status');
      touch(row, { draft, hasDraft: true });
      return ok({ draft });
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/work/workflows/:id/validate',
    handle: (request, db) => {
      const row = findWorkflow(db, request.params['id']);
      return row ? ok(validateDraft(draftOf(row))) : notFound('Workflow');
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/work/workflows/:id/publish',
    handle: (request, db) => {
      if (!can(db, PROJECT_CONFIGURE)) return forbidden();
      const row = findWorkflow(db, request.params['id']);
      if (!row) return notFound('Workflow');
      const body = bodyOf<{ statusMapping: Record<string, string> }>(request);
      return publish(db, row, body.statusMapping ?? {});
    },
  },
];

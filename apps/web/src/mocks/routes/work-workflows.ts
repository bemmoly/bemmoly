import { can, emit } from '../db.ts';
import { newId } from '../seed/time.ts';
import { WORK_IDS } from '../seed/work-settings.ts';
import { bodyOf, fail, invalid, notFound, ok, type MockRoute } from '../types.ts';
import { PROJECT_CONFIGURE, touch, workState, type Row } from './work-state.ts';

const forbidden = () => fail(403, 'forbidden', 'You need "Configure project" to do that.');

interface DraftStatus extends Row {
  name: string;
  category: string;
  position: number;
  x?: number;
  y?: number;
}
interface DraftTransition extends Row {
  fromStatusId: string | null;
  toStatusId: string;
  name: string;
}
interface Draft {
  statuses: DraftStatus[];
  transitions: DraftTransition[];
}

/** The published statuses and transitions as an editor draft, when none is saved. */
function draftOf(workflow: Row): Draft {
  const draft = workflow['draft'] as Draft | null;
  if (draft) return draft;
  return {
    statuses: (workflow['statuses'] as DraftStatus[]).map((status) => ({ ...status })),
    transitions: (workflow['transitions'] as DraftTransition[]).map((transition) => ({
      ...transition,
    })),
  };
}

/** The checks the engine makes before publish, as the Validate panel lists them. */
function validate(draft: Draft) {
  const problems: Array<{
    code: string;
    message: string;
    statusId?: string;
    transitionId?: string;
  }> = [];
  const ids = new Set(draft.statuses.map((status) => status.id));
  const seen = new Set<string>();
  for (const status of draft.statuses) {
    const key = status.name.trim().toLowerCase();
    if (seen.has(key))
      problems.push({
        code: 'duplicate_status',
        message: `Two statuses are named "${status.name}"`,
        statusId: status.id,
      });
    seen.add(key);
    const reachable = draft.transitions.some(
      (transition) => transition.toStatusId === status.id && transition.fromStatusId !== status.id,
    );
    if (!reachable && status.position !== 0)
      problems.push({
        code: 'unreachable',
        message: `No transition leads to "${status.name}"`,
        statusId: status.id,
      });
  }
  if (!draft.statuses.some((status) => status.category === 'done'))
    problems.push({
      code: 'no_done',
      message: 'The workflow needs a Done status so issues can resolve',
    });
  for (const transition of draft.transitions) {
    if (
      !ids.has(transition.toStatusId) ||
      (transition.fromStatusId && !ids.has(transition.fromStatusId))
    )
      problems.push({
        code: 'dangling',
        message: `"${transition.name}" points at a removed status`,
        transitionId: transition.id,
      });
  }
  return { valid: problems.length === 0, problems };
}

const findWorkflow = (db: Parameters<typeof workState>[0], id: string | undefined) =>
  workState(db).workflows.find((row) => row.id === id);

export const workWorkflowRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/work/projects/:projectId/workflows',
    handle: (request, db) =>
      request.params['projectId'] === WORK_IDS.project
        ? ok({
            items: workState(db).workflows.filter((row) => row['projectId'] === WORK_IDS.project),
          })
        : notFound('Project'),
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
      return row ? ok(validate(draftOf(row))) : notFound('Workflow');
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/work/workflows/:id/publish',
    handle: (request, db) => {
      if (!can(db, PROJECT_CONFIGURE)) return forbidden();
      const row = findWorkflow(db, request.params['id']);
      if (!row) return notFound('Workflow');
      const state = workState(db);
      const draft = draftOf(row);
      const result = validate(draft);
      if (!result.valid)
        return fail(409, 'workflow_invalid', 'Fix the problems before publishing', result);
      const mapping =
        bodyOf<{ statusMapping: Record<string, string> }>(request).statusMapping ?? {};
      const kept = new Set(draft.statuses.map((status) => status.id));
      for (const status of row['statuses'] as DraftStatus[]) {
        if (kept.has(status.id) || !(state.statusCounts[status.id] ?? 0)) continue;
        const target = mapping[status.id];
        if (!target || !kept.has(target))
          return invalid(
            `statusMapping.${status.id}`,
            `Choose where issues in "${status.name}" go`,
          );
        state.statusCounts[target] =
          (state.statusCounts[target] ?? 0) + (state.statusCounts[status.id] ?? 0);
        delete state.statusCounts[status.id];
      }
      const ids = new Map(
        draft.statuses.map((status) => [
          status.id,
          kept.has(status.id) && status.id.includes('-') ? status.id : newId(),
        ]),
      );
      const statuses = draft.statuses.map((status) => ({
        ...status,
        id: ids.get(status.id) ?? status.id,
        workflowId: row.id,
      }));
      const transitions = draft.transitions.map((transition) => ({
        ...transition,
        id: transition.id.includes('-') ? transition.id : newId(),
        workflowId: row.id,
        fromStatusId: transition.fromStatusId
          ? (ids.get(transition.fromStatusId) ?? transition.fromStatusId)
          : null,
        toStatusId: ids.get(transition.toStatusId) ?? transition.toStatusId,
      }));
      touch(row, {
        statuses,
        transitions,
        draft: null,
        hasDraft: false,
        publishedVersion: Number(row['publishedVersion']) + 1,
      });
      emit(db, 'work.workflow.published', [row.id]);
      return ok(row);
    },
  },
];

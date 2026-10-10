import { can, emit, type MockDb } from '../db.ts';
import { newId } from '../seed/time.ts';
import { WORK_IDS } from '../seed/work-settings.ts';
import { bodyOf, fail, invalid, notFound, ok, type MockRoute } from '../types.ts';
import { PROJECT_CONFIGURE, touch, workState, type Row, type WorkState } from './work-state.ts';

const forbidden = () => fail(403, 'forbidden', 'You need "Configure project" to do that.');

const SCHEME_NAMES = {
  issue_types: 'Software',
  fields: 'Software',
  workflow: 'Software workflow',
  board: 'Software (Scrum)',
};
type SchemeKind = keyof typeof SCHEME_NAMES;
const isKind = (kind: string): kind is SchemeKind => kind in SCHEME_NAMES;

/** Settings that differ between a project copy and its origin, as dotted paths with labels. */
function diffEntries(base: unknown, override: unknown, path = ''): Array<Record<string, unknown>> {
  if (JSON.stringify(base) === JSON.stringify(override)) return [];
  const object = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
  if (object(base) && object(override)) {
    return [...new Set([...Object.keys(base), ...Object.keys(override)])].flatMap((key) =>
      diffEntries(base[key], override[key], path ? `${path}.${key}` : key),
    );
  }
  if (Array.isArray(base) && Array.isArray(override) && base.length === override.length) {
    return base.flatMap((item, index) => diffEntries(item, override[index], `${path}[${index}]`));
  }
  const label = path.replace(/\[(\d+)\]/g, ' $1').replace(/\./g, ' › ');
  return [{ path, label, base: base ?? null, override: override ?? null }];
}

function schemeDiff(state: WorkState, kind: SchemeKind) {
  const overrides = state.project['schemeOverrides'] as Record<string, boolean>;
  if (!overrides[kind]) return [];
  if (kind === 'board') {
    const [org, project] = state.boards;
    return diffEntries(org?.['config'], project?.['config']);
  }
  if (kind === 'fields') {
    return state.fields
      .filter((field) => field['projectId'] === WORK_IDS.project)
      .map((field) => ({
        path: `fields.${field['key']}`,
        label: `Field ${field['name']}`,
        base: null,
        override: field['name'],
      }));
  }
  return [];
}

/** The diff route answers in the shared schemeDiffSchema: change plus both sides. */
function schemeDiffResponse(state: WorkState, kind: SchemeKind) {
  const overrides = state.project['schemeOverrides'] as Record<string, boolean>;
  return {
    kind,
    overridden: Boolean(overrides[kind]),
    mark: null,
    entries: schemeDiff(state, kind).map((entry) => {
      const before = entry['base'];
      const after = entry['override'];
      return {
        key: String(entry['path']),
        label: String(entry['label']),
        change: before === null ? 'added' : after === null ? 'removed' : 'changed',
        ...(before === null ? {} : { before }),
        ...(after === null ? {} : { after }),
        attributes: [],
      };
    }),
  };
}

function schemes(state: WorkState) {
  const overrides = state.project['schemeOverrides'] as Record<string, boolean>;
  return (Object.keys(SCHEME_NAMES) as SchemeKind[]).map((kind) => ({
    kind,
    originName: SCHEME_NAMES[kind],
    overridden: Boolean(overrides[kind]),
    overrideCount: schemeDiff(state, kind).length,
  }));
}

function setOverride(db: MockDb, state: WorkState, kind: SchemeKind, on: boolean) {
  const overrides = { ...(state.project['schemeOverrides'] as Record<string, boolean>) };
  if (on) overrides[kind] = true;
  else delete overrides[kind];
  touch(state.project, { schemeOverrides: overrides });
  if (kind === 'board' && !on) {
    const [org, project] = state.boards;
    if (org && project) touch(project, { config: structuredClone(org['config']) });
  }
  if (kind === 'fields' && !on) {
    state.fields = state.fields.filter((field) => field['projectId'] !== WORK_IDS.project);
  }
  emit(db, 'work.project.updated', [WORK_IDS.project]);
}

const project = (request: { params: Record<string, string> }, state: WorkState) =>
  request.params['projectId'] === WORK_IDS.project || request.params['key'] === 'PLT'
    ? state.project
    : null;

function listOf(key: 'boards' | 'issueTypes' | 'fields'): MockRoute {
  const path = { boards: 'boards', issueTypes: 'issue-types', fields: 'fields' }[key];
  return {
    method: 'GET',
    pattern: `/api/v1/work/projects/:projectId/${path}`,
    handle: (request, db) => {
      const state = workState(db);
      if (!project(request, state)) return notFound('Project');
      const rows = state[key].filter(
        (row) => row['projectId'] === null || row['projectId'] === WORK_IDS.project,
      );
      return ok({
        items: key === 'boards' ? rows.filter((row) => row['projectId'] !== null) : rows,
      });
    },
  };
}

function patchOf(key: 'issueTypes' | 'fields', what: string, path: string): MockRoute {
  return {
    method: 'PATCH',
    pattern: `/api/v1/work/${path}/:id`,
    handle: (request, db) => {
      if (!can(db, PROJECT_CONFIGURE)) return forbidden();
      const row = workState(db)[key].find((item) => item.id === request.params['id']);
      if (!row) return notFound(what);
      touch(row, bodyOf<Row>(request));
      emit(db, `work.${path}.updated`, [row.id]);
      return ok(row);
    },
  };
}

function createOf(
  key: 'issueTypes' | 'fields',
  path: string,
  defaults: Record<string, unknown>,
): MockRoute {
  return {
    method: 'POST',
    pattern: `/api/v1/work/projects/:projectId/${path}`,
    handle: (request, db) => {
      if (!can(db, PROJECT_CONFIGURE)) return forbidden();
      const state = workState(db);
      if (!project(request, state)) return notFound('Project');
      const body = bodyOf<Row>(request);
      if (state[key].some((row) => row['key'] === body['key']))
        return invalid('key', `A ${path.replace('-', ' ').slice(0, -1)} with this key exists`);
      const now = new Date().toISOString();
      const row: Row = {
        ...defaults,
        ...body,
        id: newId(),
        projectId: WORK_IDS.project,
        originId: null,
        createdAt: now,
        updatedAt: now,
      };
      state[key].push(row);
      if (key === 'fields') setOverride(db, state, 'fields', true);
      return ok(row, 201);
    },
  };
}

export const workSettingsRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/work/projects/by-key/:key',
    handle: (request, db) => {
      const row = project(request, workState(db));
      return row ? ok(row) : notFound('Project');
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/work/projects/:projectId',
    handle: (request, db) => {
      const row = project(request, workState(db));
      return row ? ok(row) : notFound('Project');
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/work/projects/:projectId',
    handle: (request, db) => {
      if (!can(db, PROJECT_CONFIGURE)) return forbidden();
      const state = workState(db);
      if (!project(request, state)) return notFound('Project');
      touch(state.project, bodyOf<Row>(request));
      emit(db, 'work.project.updated', [state.project.id]);
      return ok(state.project);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/work/projects/:projectId/schemes',
    handle: (request, db) => {
      const state = workState(db);
      return project(request, state) ? ok({ items: schemes(state) }) : notFound('Project');
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/work/projects/:projectId/schemes/:kind/diff',
    handle: (request, db) => {
      const kind = request.params['kind'] ?? '';
      if (!isKind(kind)) return notFound('Scheme');
      const state = workState(db);
      return ok(schemeDiffResponse(state, kind));
    },
  },
  ...(['override', 'reset'] as const).map((action): MockRoute => ({
    method: 'POST',
    pattern: `/api/v1/work/projects/:projectId/schemes/:kind/${action}`,
    handle: (request, db) => {
      if (!can(db, PROJECT_CONFIGURE)) return forbidden();
      const kind = request.params['kind'] ?? '';
      if (!isKind(kind)) return notFound('Scheme');
      setOverride(db, workState(db), kind, action === 'override');
      return ok();
    },
  })),
  listOf('boards'),
  listOf('issueTypes'),
  listOf('fields'),
  patchOf('issueTypes', 'Issue type', 'issue-types'),
  patchOf('fields', 'Field', 'fields'),
  {
    method: 'POST',
    pattern: '/api/v1/work/projects/:projectId/issue-types/reorder',
    handle: (request, db) => {
      if (!can(db, PROJECT_CONFIGURE)) return forbidden();
      const state = workState(db);
      const { ids } = bodyOf<{ ids: string[] }>(request);
      for (const row of state.issueTypes) {
        const at = ids.indexOf(row.id);
        if (at >= 0) touch(row, { position: at });
      }
      emit(db, 'work.issue-types.updated', ids);
      return ok({
        items: state.issueTypes.filter(
          (row) => row['projectId'] === null || row['projectId'] === WORK_IDS.project,
        ),
      });
    },
  },
  createOf('issueTypes', 'issue-types', {
    description: null,
    icon: null,
    color: null,
    level: 'standard',
    position: 99,
  }),
  createOf('fields', 'fields', { options: [], filterable: false, aiFill: false }),
  {
    method: 'GET',
    pattern: '/api/v1/work/issue-types/:id/fields',
    handle: (request, db) =>
      ok({
        items: workState(db).typeFields.filter(
          (row) => row['issueTypeId'] === request.params['id'],
        ),
      }),
  },
  {
    method: 'PUT',
    pattern: '/api/v1/work/issue-types/:id/fields',
    handle: (request, db) => {
      if (!can(db, PROJECT_CONFIGURE)) return forbidden();
      const state = workState(db);
      const issueTypeId = request.params['id'] ?? '';
      const items =
        bodyOf<{ items: Array<{ fieldId: string; required: boolean; onCard: boolean }> }>(request)
          .items ?? [];
      state.typeFields = [
        ...state.typeFields.filter((row) => row['issueTypeId'] !== issueTypeId),
        ...items.map((item, position) => ({ id: newId(), issueTypeId, ...item, position })),
      ];
      emit(db, 'work.issue-types.updated', [issueTypeId]);
      return ok({ items: state.typeFields.filter((row) => row['issueTypeId'] === issueTypeId) });
    },
  },
];

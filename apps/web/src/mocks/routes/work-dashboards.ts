import type { MockDb } from '../db.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, invalid, notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import { projectRef } from './work-board-state.ts';
import type { Row } from './work-state.ts';

/*
 * Report dashboards on the in-memory backend, answering /work/dashboards as the server does:
 * each person sees only their own; a new one starts with the project's default reports; the
 * layout is written whole. Shapes follow modules/work/shared/dashboards.ts. Kept per mock
 * database like the filters.
 */

const W = '/api/v1/work/dashboards';
const MAX_WIDGETS = 24;
const states = new WeakMap<MockDb, Row[]>();
const TYPES = new Set([
  'burndown',
  'burnup',
  'velocity',
  'cumulative-flow',
  'created-resolved',
  'control-chart',
  'time-in-status',
  'scope-burnup',
  'quarter',
  'pinned',
]);
const DEFAULT_CONFIG: Record<string, Record<string, unknown>> = {
  'cumulative-flow': { days: 30 },
  'created-resolved': { days: 30 },
  'control-chart': { days: 90 },
  'time-in-status': { days: 90 },
  'scope-burnup': { kind: 'epic' },
};

const widget = (type: string) => ({
  id: newId(),
  type,
  size: type === 'quarter' ? 'full' : 'half',
  config: DEFAULT_CONFIG[type] ?? {},
});

function defaults(method: unknown) {
  const types =
    method === 'kanban'
      ? ['cumulative-flow', 'created-resolved', 'control-chart', 'time-in-status', 'quarter']
      : ['burndown', 'burnup', 'velocity', 'cumulative-flow', 'quarter'];
  return types.map(widget);
}

function dashboards(db: MockDb): Row[] {
  let rows = states.get(db);
  if (!rows) {
    rows = [];
    states.set(db, rows);
  }
  return rows;
}

/** A layout the server would accept: known types, a size, a config, distinct ids, the cap. */
function checkWidgets(value: unknown) {
  if (!Array.isArray(value)) return { error: invalid('widgets', 'Send the widgets as a list.') };
  if (value.length > MAX_WIDGETS) {
    return { error: invalid('widgets', `A dashboard holds at most ${MAX_WIDGETS} widgets`) };
  }
  const seen = new Set<string>();
  const widgets: Row[] = [];
  for (const raw of value as Row[]) {
    if (!TYPES.has(String(raw['type'])) || !['half', 'full'].includes(String(raw['size']))) {
      return { error: invalid('widgets', 'A widget names a known report and a size.') };
    }
    const id = typeof raw['id'] === 'string' ? raw['id'] : newId();
    if (seen.has(id)) return { error: invalid('widgets', 'Each widget needs its own id') };
    seen.add(id);
    widgets.push({ id, type: raw['type'], size: raw['size'], config: raw['config'] ?? {} });
  }
  return { widgets };
}

function owned(request: MockRequest, db: MockDb) {
  return dashboards(db).find(
    (row) => row.id === request.params['id'] && row['ownerId'] === db.signedInAs,
  );
}

const touch = (row: Row) => Object.assign(row, { updatedAt: new Date().toISOString() });

export const workDashboardRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: W,
    handle: (request, db) => {
      const project = projectRef(db, request.query.get('projectId') ?? '');
      if (!project) return notFound('Project');
      const items = dashboards(db).filter(
        (row) => row['ownerId'] === db.signedInAs && row['projectId'] === project.id,
      );
      return ok({ items });
    },
  },
  {
    method: 'POST',
    pattern: W,
    handle: (request, db) => {
      const body = bodyOf<Row>(request);
      const name = String(body['name'] ?? '').trim();
      if (!name) return invalid('name', 'Give the dashboard a name.');
      const project = projectRef(db, String(body['projectId'] ?? ''));
      if (!project) return notFound('Project');
      const checked =
        body['widgets'] === undefined
          ? { widgets: defaults(project['method']) }
          : checkWidgets(body['widgets']);
      if (!checked.widgets) return checked.error;
      const now = new Date().toISOString();
      const row: Row = {
        id: newId(),
        ownerId: db.signedInAs,
        projectId: project.id,
        name,
        widgets: checked.widgets,
        createdAt: now,
        updatedAt: now,
      };
      dashboards(db).push(row);
      return ok(row, 201);
    },
  },
  {
    method: 'GET',
    pattern: `${W}/:id`,
    handle: (request, db) => {
      const row = owned(request, db);
      return row ? ok(row) : notFound('The dashboard');
    },
  },
  {
    method: 'PATCH',
    pattern: `${W}/:id`,
    handle: (request, db) => {
      const row = owned(request, db);
      if (!row) return notFound('The dashboard');
      const body = bodyOf<Row>(request);
      if (body['name'] !== undefined) {
        const name = String(body['name']).trim();
        if (!name) return invalid('name', 'Give the dashboard a name.');
        row['name'] = name;
      }
      if (body['widgets'] !== undefined) {
        const checked = checkWidgets(body['widgets']);
        if (!checked.widgets) return checked.error;
        row['widgets'] = checked.widgets;
      }
      return ok(touch(row));
    },
  },
  {
    method: 'DELETE',
    pattern: `${W}/:id`,
    handle: (request, db) => {
      const row = owned(request, db);
      if (!row) return notFound('The dashboard');
      const list = dashboards(db);
      list.splice(list.indexOf(row), 1);
      return ok(undefined, 204);
    },
  },
  {
    method: 'POST',
    pattern: `${W}/:id/widgets`,
    handle: (request, db) => {
      const row = owned(request, db);
      if (!row) return notFound('The dashboard');
      const body = bodyOf<{ widget: Row; position: number }>(request);
      const current = row['widgets'] as Row[];
      const checked = checkWidgets([...current, { ...body.widget, id: undefined }]);
      if (!checked.widgets) return checked.error;
      const added = checked.widgets.at(-1) as Row;
      const next = [...current];
      next.splice(Math.min(body.position ?? next.length, next.length), 0, added);
      row['widgets'] = next;
      return ok(touch(row), 201);
    },
  },
  {
    method: 'DELETE',
    pattern: `${W}/:id/widgets/:widgetId`,
    handle: (request, db) => {
      const row = owned(request, db);
      if (!row) return notFound('The dashboard');
      const current = row['widgets'] as Row[];
      const next = current.filter((item) => item.id !== request.params['widgetId']);
      if (next.length === current.length) return notFound('The widget');
      row['widgets'] = next;
      touch(row);
      return ok(undefined, 204);
    },
  },
];

import {
  importContainerQuerySchema,
  importCountBodySchema,
  importSelectionBodySchema,
  type ImportContainerCounts,
} from '@bemmoly/shared';
import { can } from '../db.ts';
import { fail, invalid, notFound, ok, type MockRoute } from '../types.ts';
import {
  applyOps,
  chooserOf,
  matching,
  rowOf,
  summaryOf,
  type ChooserState,
} from './import-state.ts';

const SETTINGS = 'workspace.settings.manage';
const BASE = '/api/v1/admin/imports/:id';

const adminOnly =
  (handle: MockRoute['handle']): MockRoute['handle'] =>
  (request, db) =>
    can(db, SETTINGS) ? handle(request, db) : fail(403, 'forbidden', 'You cannot do that.');

function countsOf(state: ChooserState, q: string | undefined): ImportContainerCounts {
  return {
    all: matching(state, q, 'all').length,
    new: matching(state, q, 'new').length,
    imported: matching(state, q, 'imported').length,
    noaccess: matching(state, q, 'noaccess').length,
    selected: matching(state, q, 'selected').length,
    attention: matching(state, q, 'attention').length,
  };
}

/** The chooser's endpoints: a page of rows, counts on demand, and the selection. */
export const importContainerRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${BASE}/containers`,
    handle: adminOnly((request) => {
      const state = chooserOf(request.params['id']);
      if (!state) return notFound('Import');
      const parsed = importContainerQuerySchema.safeParse(Object.fromEntries(request.query));
      if (!parsed.success) return invalid('query', parsed.error.message);
      const { q, filter, cursor, limit } = parsed.data;
      const rows = matching(state, q, filter);
      // Keyset over the listing order: the cursor is the position after the last row sent.
      const from = cursor ? Number(cursor) : 0;
      const items = rows.slice(from, from + limit).map((row) => rowOf(state, row));
      const selectable = rows.filter((row) => row.access === 'ok');
      return ok({
        items,
        next: from + limit < rows.length ? String(from + limit) : null,
        view: {
          total: rows.length,
          selectable: selectable.length,
          selected: selectable.filter((row) => state.selected.has(row.id)).length,
        },
        counts: countsOf(state, q),
      });
    }),
  },
  {
    method: 'POST',
    pattern: `${BASE}/containers/counts`,
    handle: adminOnly((request) => {
      const state = chooserOf(request.params['id']);
      if (!state) return notFound('Import');
      const parsed = importCountBodySchema.safeParse(request.body);
      if (!parsed.success) return invalid('ids', parsed.error.message);
      const items = state.rows
        .filter((row) => parsed.data.ids.includes(row.id))
        .map((row) => {
          state.counted.add(row.id);
          return { id: row.id, count: row.access === 'none' ? 0 : row.records };
        });
      return ok({ items });
    }),
  },
  {
    method: 'GET',
    pattern: `${BASE}/selection`,
    handle: adminOnly((request) => {
      const state = chooserOf(request.params['id']);
      return state ? ok(summaryOf(state)) : notFound('Import');
    }),
  },
  {
    method: 'PATCH',
    pattern: `${BASE}/selection`,
    handle: adminOnly((request) => {
      const state = chooserOf(request.params['id']);
      if (!state) return notFound('Import');
      const parsed = importSelectionBodySchema.safeParse(request.body);
      if (!parsed.success) return invalid('ops', parsed.error.message);
      applyOps(state, parsed.data.ops);
      return ok(summaryOf(state));
    }),
  },
];

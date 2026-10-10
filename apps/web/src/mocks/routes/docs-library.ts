import { emit } from '../db.ts';
import { notFound, ok, page, type MockRoute } from '../types.ts';
import { docsState, live, presentSummary, spaceByRef } from './docs-state.ts';

/*
 * The Docs home lists, stars, templates, the trash and page search on the
 * in-memory backend, in the Docs server's shapes.
 */

const BASE = '/api/v1/docs';

const newestFirst = (a: { updatedAt: string }, b: { updatedAt: string }) =>
  b.updatedAt.localeCompare(a.updatedAt);

export const docsLibraryRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${BASE}/home/recent`,
    handle: (request, db) => {
      const state = docsState(db);
      const mine = request.query.get('mine') === 'true';
      const rows = state.pages
        .filter((row) => live(row) && (!mine || row.ownerId === db.signedInAs))
        .sort(newestFirst);
      return ok(
        page(
          rows.map((row) => presentSummary(state, row)),
          request,
          20,
        ),
      );
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/home/starred`,
    handle: (request, db) => {
      const state = docsState(db);
      const ids = [...(state.stars.get(db.signedInAs ?? '') ?? [])].reverse();
      const rows = ids.flatMap((id) => {
        const row = state.pages.find((item) => item.id === id && live(item));
        return row ? [presentSummary(state, row)] : [];
      });
      return ok(page(rows, request, 20));
    },
  },
  {
    method: 'PUT',
    pattern: `${BASE}/pages/:pageId/star`,
    handle: (request, db) => {
      const state = docsState(db);
      const id = request.params['pageId'] ?? '';
      if (!state.pages.some((row) => row.id === id && live(row))) return notFound('The page');
      const userId = db.signedInAs ?? '';
      const stars = (state.stars.get(userId) ?? []).filter((star) => star !== id);
      state.stars.set(userId, [...stars, id]);
      emit(db, 'docs.page', [id]);
      return ok({ starred: true });
    },
  },
  {
    method: 'DELETE',
    pattern: `${BASE}/pages/:pageId/star`,
    handle: (request, db) => {
      const state = docsState(db);
      const id = request.params['pageId'] ?? '';
      const userId = db.signedInAs ?? '';
      state.stars.set(
        userId,
        (state.stars.get(userId) ?? []).filter((star) => star !== id),
      );
      emit(db, 'docs.page', [id]);
      return ok({ starred: false });
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/templates`,
    handle: (_request, db) => ok({ items: docsState(db).templates }),
  },
  {
    method: 'GET',
    pattern: `${BASE}/spaces/:spaceKey/trash`,
    handle: (request, db) => {
      const state = docsState(db);
      const space = spaceByRef(state, request.params['spaceKey'] ?? '');
      if (!space) return notFound(`Space ${request.params['spaceKey']}`);
      const rows = state.pages.filter((row) => row.spaceId === space.id && !live(row));
      return ok(
        page(
          rows.map((row) => presentSummary(state, row)),
          request,
        ),
      );
    },
  },
  {
    method: 'DELETE',
    pattern: `${BASE}/spaces/:spaceKey/trash`,
    handle: (request, db) => {
      const state = docsState(db);
      const space = spaceByRef(state, request.params['spaceKey'] ?? '');
      if (!space) return notFound(`Space ${request.params['spaceKey']}`);
      const before = state.pages.length;
      state.pages = state.pages.filter((row) => row.spaceId !== space.id || live(row));
      emit(db, 'docs.tree', []);
      return ok({ deleted: before - state.pages.length });
    },
  },
  {
    method: 'DELETE',
    pattern: `${BASE}/spaces/:spaceKey/trash/:pageId`,
    handle: (request, db) => {
      const state = docsState(db);
      const space = spaceByRef(state, request.params['spaceKey'] ?? '');
      const root = state.pages.find((row) => row.id === request.params['pageId'] && !live(row));
      if (!space || !root || root.spaceId !== space.id) return notFound('Page in the trash');
      state.pages = state.pages.filter((row) => !row.path.startsWith(root.path));
      emit(db, 'docs.tree', [root.id]);
      return ok();
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/search/suggest`,
    handle: (request, db) => {
      const state = docsState(db);
      const q = (request.query.get('q') ?? '').toLowerCase();
      const rows = state.pages
        .filter((row) => live(row) && row.title.toLowerCase().includes(q))
        .slice(0, Number(request.query.get('limit') ?? 8));
      return ok({
        items: rows.map((row) => {
          const { id, spaceId, spaceKey, title, icon, status } = presentSummary(state, row);
          return { id, spaceId, spaceKey, title, icon, status };
        }),
      });
    },
  },
];

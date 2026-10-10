import { can, emit, type MockDb } from '../db.ts';
import type { MockPage } from '../seed/docs.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, fail, notFound, ok, page, type MockRequest, type MockRoute } from '../types.ts';
import {
  childrenOf,
  docsState,
  live,
  nextPosition,
  presentDetail,
  presentSpace,
  presentSummary,
  spaceByRef,
} from './docs-state.ts';

/*
 * Spaces, pages, the tree, moves and the review flow on the in-memory
 * backend, in the Docs server's shapes. Edits need docs.page.edit as on the
 * server; the mock skips space membership, which the seed gives everyone.
 */

const BASE = '/api/v1/docs';
const now = () => new Date().toISOString();

function detail(db: MockDb, row: MockPage) {
  const owner = db.users.find((user) => user.id === row.ownerId);
  return presentDetail(docsState(db), row, db.signedInAs, owner?.name ?? null);
}

function pageOf(db: MockDb, request: MockRequest, deleted = false) {
  const row = docsState(db).pages.find((item) => item.id === request.params['pageId']);
  return row && (deleted || live(row)) ? row : undefined;
}

const denied = () => fail(403, 'forbidden', 'You do not have permission to do this');

export const docsRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${BASE}/spaces`,
    handle: (request, db) => {
      const state = docsState(db);
      const rows = state.spaces.filter((space) => !space.archivedAt);
      return ok(
        page(
          rows.map((space) => presentSpace(state, space)),
          request,
          200,
        ),
      );
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/spaces/:spaceKey`,
    handle: (request, db) => {
      const state = docsState(db);
      const space = spaceByRef(state, request.params['spaceKey'] ?? '');
      return space
        ? ok(presentSpace(state, space))
        : notFound(`Space ${request.params['spaceKey']}`);
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/spaces/:spaceKey/tree`,
    handle: (request, db) => {
      const state = docsState(db);
      const space = spaceByRef(state, request.params['spaceKey'] ?? '');
      if (!space) return notFound(`Space ${request.params['spaceKey']}`);
      const rows = childrenOf(state, space.id, request.query.get('parentId'));
      return ok(
        page(
          rows.map((row) => presentSummary(state, row)),
          request,
        ),
      );
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/pages/:pageId`,
    handle: (request, db) => {
      const row = pageOf(db, request, request.query.get('deleted') === 'true');
      return row ? ok(detail(db, row)) : notFound('The page');
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/pages`,
    handle: (request, db) => {
      if (!can(db, 'docs.page.edit')) return denied();
      const body = bodyOf<{ spaceId: string; parentId: string | null; title: string }>(request);
      const state = docsState(db);
      const space = state.spaces.find((row) => row.id === body.spaceId);
      if (!space) return notFound('The space');
      const parent = body.parentId ? state.pages.find((row) => row.id === body.parentId) : null;
      const id = newId();
      const row: MockPage = {
        id,
        spaceId: space.id,
        parentId: parent?.id ?? null,
        position: nextPosition(childrenOf(state, space.id, parent?.id ?? null)),
        path: `${parent?.path ?? '/'}${id}/`,
        title: body.title ?? '',
        icon: null,
        status: 'draft',
        ownerId: db.signedInAs,
        reviewers: [],
        templateId: null,
        text: '',
        labels: [],
        wordCount: 0,
        version: 1,
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null,
      };
      state.pages.push(row);
      emit(db, 'docs.tree', [id]);
      return ok(detail(db, row), 201);
    },
  },
  {
    method: 'PATCH',
    pattern: `${BASE}/pages/:pageId`,
    handle: (request, db) => {
      if (!can(db, 'docs.page.edit')) return denied();
      const row = pageOf(db, request);
      if (!row) return notFound('The page');
      const body = bodyOf<{
        title: string;
        icon: string | null;
        ownerId: string | null;
        version: number;
      }>(request);
      if (body.version !== undefined && body.version !== row.version) {
        return fail(409, 'conflict', 'The page changed since you opened it; reload it');
      }
      if (body.title !== undefined) row.title = body.title;
      if (body.icon !== undefined) row.icon = body.icon;
      if (body.ownerId !== undefined) row.ownerId = body.ownerId;
      row.version += 1;
      row.updatedAt = now();
      emit(db, 'docs.page', [row.id]);
      return ok(detail(db, row));
    },
  },
  {
    method: 'DELETE',
    pattern: `${BASE}/pages/:pageId`,
    handle: (request, db) => {
      const row = pageOf(db, request);
      if (!row) return notFound('The page');
      const at = now();
      for (const item of docsState(db).pages) {
        if (live(item) && item.path.startsWith(row.path)) item.deletedAt = at;
      }
      emit(db, 'docs.tree', [row.id]);
      return ok();
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/pages/:pageId/restore`,
    handle: (request, db) => {
      const row = pageOf(db, request, true);
      if (!row) return notFound('The page');
      const at = row.deletedAt;
      for (const item of docsState(db).pages) {
        if (at && item.deletedAt === at && item.path.startsWith(row.path)) item.deletedAt = null;
      }
      emit(db, 'docs.tree', [row.id]);
      return ok(detail(db, row));
    },
  },
  {
    method: 'PUT',
    pattern: `${BASE}/pages/:pageId/status`,
    handle: (request, db) => {
      const row = pageOf(db, request);
      if (!row) return notFound('The page');
      const status = bodyOf<{ status: MockPage['status'] }>(request).status ?? row.status;
      const publishing = status === 'published' || status === 'archived';
      if (!can(db, publishing ? 'docs.page.publish' : 'docs.page.edit')) return denied();
      row.status = status;
      row.version += 1;
      row.updatedAt = now();
      emit(db, 'docs.page', [row.id]);
      return ok(detail(db, row));
    },
  },
  {
    method: 'PUT',
    pattern: `${BASE}/pages/:pageId/reviewers`,
    handle: (request, db) => {
      if (!can(db, 'docs.page.edit')) return denied();
      const row = pageOf(db, request);
      if (!row) return notFound('The page');
      row.reviewers = bodyOf<{ reviewers: string[] }>(request).reviewers ?? [];
      row.version += 1;
      emit(db, 'docs.page', [row.id]);
      return ok(detail(db, row));
    },
  },
];

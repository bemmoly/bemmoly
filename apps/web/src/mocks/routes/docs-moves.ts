import { can, emit } from '../db.ts';
import type { MockPage, MockSpace } from '../seed/docs.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, fail, notFound, ok, type MockRoute } from '../types.ts';
import {
  childrenOf,
  docsState,
  live,
  nextPosition,
  presentDetail,
  presentSpace,
  presentSummary,
  type DocsState,
} from './docs-state.ts';

/*
 * Moves in the tree, new spaces and pages made from a template on the
 * in-memory backend, in the Docs server's shapes. A move rewrites the
 * positions of the level it lands in, which keeps order exact without the
 * server's lexorank.
 */

const BASE = '/api/v1/docs';
const now = () => new Date().toISOString();
const denied = () => fail(403, 'forbidden', 'You do not have permission to do this');

interface MoveBody {
  parentId: string | null;
  afterId?: string | null;
  beforeId?: string | null;
}

/** Puts `row` among `siblings` by its neighbours and numbers the level afresh. */
function placeAmong(siblings: MockPage[], row: MockPage, body: MoveBody) {
  const after = body.afterId ? siblings.findIndex((item) => item.id === body.afterId) : -1;
  const before = body.beforeId ? siblings.findIndex((item) => item.id === body.beforeId) : -1;
  const at = after >= 0 ? after + 1 : before >= 0 ? before : siblings.length;
  const ordered = [...siblings.slice(0, at), row, ...siblings.slice(at)];
  ordered.forEach((item, index) => {
    item.position = `p${String(index).padStart(5, '0')}`;
  });
}

function move(state: DocsState, row: MockPage, body: MoveBody) {
  const parent = body.parentId ? state.pages.find((item) => item.id === body.parentId) : null;
  if (body.parentId && (!parent || !live(parent))) return notFound('The new parent');
  if (parent && parent.path.startsWith(row.path)) {
    return fail(422, 'validation_failed', 'A page cannot move into its own subtree');
  }
  const siblings = childrenOf(state, row.spaceId, parent?.id ?? null).filter(
    (item) => item.id !== row.id,
  );
  const oldPath = row.path;
  const newPath = `${parent?.path ?? '/'}${row.id}/`;
  let moved = 0;
  for (const item of state.pages) {
    if (item.path.startsWith(oldPath)) {
      item.path = newPath + item.path.slice(oldPath.length);
      moved += 1;
    }
  }
  row.parentId = parent?.id ?? null;
  row.updatedAt = now();
  placeAmong(siblings, row, body);
  return ok({ page: presentSummary(state, row), movedCount: moved });
}

export const docsMoveRoutes: MockRoute[] = [
  {
    method: 'POST',
    pattern: `${BASE}/pages/:pageId/move`,
    handle: (request, db) => {
      if (!can(db, 'docs.page.edit')) return denied();
      const state = docsState(db);
      const row = state.pages.find((item) => item.id === request.params['pageId'] && live(item));
      if (!row) return notFound('The page');
      const body = bodyOf<MoveBody>(request);
      const response = move(state, row, { ...body, parentId: body.parentId ?? null });
      emit(db, 'docs.tree', [row.id]);
      return response;
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/spaces`,
    handle: (request, db) => {
      if (!can(db, 'docs.space.create')) return denied();
      const state = docsState(db);
      const body = bodyOf<{ key: string; name: string; description?: string; color?: string }>(
        request,
      );
      const key = (body.key ?? '').toUpperCase();
      if (state.spaces.some((space) => space.key === key)) {
        return fail(409, 'conflict', `A space with the key ${key} already exists`);
      }
      const space: MockSpace = {
        id: newId(),
        key,
        name: body.name ?? key,
        description: body.description ?? null,
        icon: null,
        color: body.color ?? null,
        teamId: null,
        projectId: null,
        aiExcluded: false,
        homePageId: null,
        archivedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      state.spaces.push(space);
      emit(db, 'docs.space', [space.id]);
      return ok(presentSpace(state, space), 201);
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/templates/:templateId/pages`,
    handle: (request, db) => {
      if (!can(db, 'docs.page.edit')) return denied();
      const state = docsState(db);
      const template = state.templates.find((item) => item.id === request.params['templateId']);
      if (!template) return notFound('The template');
      const body = bodyOf<{ spaceId: string; parentId?: string | null; title?: string }>(request);
      const space = state.spaces.find((item) => item.id === body.spaceId);
      if (!space) return notFound('The space');
      const parent = body.parentId ? state.pages.find((item) => item.id === body.parentId) : null;
      const id = newId();
      const row: MockPage = {
        id,
        spaceId: space.id,
        parentId: parent?.id ?? null,
        position: nextPosition(childrenOf(state, space.id, parent?.id ?? null)),
        path: `${parent?.path ?? '/'}${id}/`,
        title: body.title || template.name,
        icon: template.icon,
        status: 'draft',
        ownerId: db.signedInAs,
        reviewers: [],
        templateId: template.id,
        text: template.description ?? '',
        labels: [],
        wordCount: 0,
        version: 1,
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null,
      };
      state.pages.push(row);
      emit(db, 'docs.tree', [id]);
      const owner = db.users.find((user) => user.id === row.ownerId);
      return ok(presentDetail(state, row, db.signedInAs, owner?.name ?? null), 201);
    },
  },
];

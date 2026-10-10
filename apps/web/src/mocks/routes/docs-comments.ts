import { can, emit, type MockDb } from '../db.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, fail, notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import type { PmNode } from './docs-diff.ts';
import {
  historyState,
  replaceText,
  snapshotOf,
  textOf,
  type MockComment,
} from './docs-history-state.ts';
import { docsState, live } from './docs-state.ts';

/* Page comments of the in-memory backend: threads one level deep, anchors read as on the server. */

const BASE = '/api/v1/docs';
const now = () => new Date().toISOString();
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
const denied = () => fail(403, 'forbidden', 'You do not have permission to do this');

function pageOf(db: MockDb, request: MockRequest) {
  const row = docsState(db).pages.find((item) => item.id === request.params['pageId']);
  return row && live(row) ? row : undefined;
}

function present(db: MockDb, comment: MockComment) {
  const author = db.users.find((user) => user.id === comment.authorId);
  const row = docsState(db).pages.find((item) => item.id === comment.pageId);
  const text = row ? normalize(textOf(snapshotOf(row))) : '';
  return {
    id: comment.id,
    pageId: comment.pageId,
    parentId: comment.parentId,
    body: comment.body,
    anchor: comment.anchor,
    aiSuggestion: comment.aiSuggestion,
    resolvedAt: comment.resolvedAt,
    resolvedBy: comment.resolvedBy,
    editedAt: comment.editedAt,
    createdAt: comment.createdAt,
    author: author ? { id: author.id, name: author.name } : null,
    bodyText: textOf(comment.body),
    anchorStatus: comment.anchor
      ? text.includes(normalize(comment.anchor.quote))
        ? 'anchored'
        : 'text_changed'
      : null,
  };
}

function commentOf(db: MockDb, request: MockRequest) {
  return historyState(db).comments.find(
    (item) => item.id === request.params['commentId'] && !item.deletedAt,
  );
}

function setResolved(db: MockDb, request: MockRequest, resolved: boolean) {
  if (!can(db, 'docs.page.edit')) return denied();
  const comment = commentOf(db, request);
  if (!comment) return notFound('Comment');
  if (comment.parentId) return fail(400, 'validation_failed', 'Resolve the thread, not a reply');
  comment.resolvedAt = resolved ? now() : null;
  comment.resolvedBy = resolved ? db.signedInAs : null;
  emit(db, 'docs.comments', [comment.pageId]);
  return ok(present(db, comment));
}

export const docsCommentRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${BASE}/pages/:pageId/comments`,
    handle: (request, db) => {
      const resolved = request.query.get('resolved');
      const all = historyState(db).comments.filter(
        (item) => item.pageId === request.params['pageId'] && !item.deletedAt,
      );
      const rootOf = (item: MockComment) =>
        all.find((root) => root.id === (item.parentId ?? item.id));
      const rows = all.filter((item) => {
        if (resolved === null) return true;
        return (rootOf(item)?.resolvedAt !== null) === (resolved === 'true');
      });
      return ok({ items: rows.map((item) => present(db, item)), nextCursor: null });
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/pages/:pageId/comments`,
    handle: (request, db) => {
      if (!can(db, 'docs.page.edit')) return denied();
      const row = pageOf(db, request);
      if (!row) return notFound('Page');
      const input = bodyOf<Pick<MockComment, 'body' | 'parentId' | 'anchor'>>(request);
      const comment: MockComment = {
        id: newId(),
        pageId: row.id,
        parentId: input.parentId ?? null,
        authorId: db.signedInAs,
        body: input.body ?? { type: 'doc' },
        anchor: input.parentId ? null : (input.anchor ?? null),
        aiSuggestion: null,
        resolvedAt: null,
        resolvedBy: null,
        editedAt: null,
        createdAt: now(),
        deletedAt: null,
      };
      historyState(db).comments.push(comment);
      emit(db, 'docs.comments', [row.id]);
      return ok(present(db, comment), 201);
    },
  },
  {
    method: 'PATCH',
    pattern: `${BASE}/comments/:commentId`,
    handle: (request, db) => {
      const comment = commentOf(db, request);
      if (!comment) return notFound('Comment');
      if (comment.authorId !== db.signedInAs) return denied();
      comment.body = bodyOf<{ body: PmNode }>(request).body ?? comment.body;
      comment.editedAt = now();
      emit(db, 'docs.comments', [comment.pageId]);
      return ok(present(db, comment));
    },
  },
  {
    method: 'DELETE',
    pattern: `${BASE}/comments/:commentId`,
    handle: (request, db) => {
      const comment = commentOf(db, request);
      if (!comment) return notFound('Comment');
      if (comment.authorId !== db.signedInAs && !can(db, 'docs.page.delete')) return denied();
      for (const item of historyState(db).comments) {
        if (item.id === comment.id || item.parentId === comment.id) item.deletedAt = now();
      }
      emit(db, 'docs.comments', [comment.pageId]);
      return ok();
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/comments/:commentId/resolve`,
    handle: (request, db) => setResolved(db, request, true),
  },
  {
    method: 'POST',
    pattern: `${BASE}/comments/:commentId/reopen`,
    handle: (request, db) => setResolved(db, request, false),
  },
  {
    method: 'POST',
    pattern: `${BASE}/comments/:commentId/apply-suggestion`,
    handle: (request, db) => {
      if (!can(db, 'docs.page.edit')) return denied();
      const comment = commentOf(db, request);
      const row = docsState(db).pages.find((item) => item.id === comment?.pageId);
      if (!comment?.anchor || !comment.aiSuggestion || !row) return notFound('Suggestion');
      const body = snapshotOf(row);
      if (!replaceText(body, comment.anchor.quote, comment.aiSuggestion.replacement)) {
        return fail(409, 'conflict', 'The text changed since this fix was suggested');
      }
      row.snapshot = body;
      comment.aiSuggestion = { ...comment.aiSuggestion, appliedAt: now() };
      comment.resolvedAt ??= now();
      emit(db, 'docs.page', [row.id]);
      emit(db, 'docs.comments', [row.id]);
      return ok(present(db, comment));
    },
  },
];

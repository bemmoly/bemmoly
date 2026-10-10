import { can, emit, type MockDb } from '../db.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, fail, notFound, ok, page, type MockRequest, type MockRoute } from '../types.ts';
import { diffDocs, type PmNode } from './docs-diff.ts';
import { docsCommentRoutes } from './docs-comments.ts';
import { docsLinkRoutes } from './docs-links.ts';
import { docsTransferRoutes } from './docs-transfer.ts';
import {
  historyState,
  snapshotOf,
  textOf,
  writeBody,
  type MockRevision,
} from './docs-history-state.ts';
import { docsState, live } from './docs-state.ts';

/*
 * Version history, comments, links and transfer of the in-memory backend, in the Docs
 * server's shapes, so the doc editor's side panel runs end to end in the dev mock. Writes
 * need docs.page.edit, as on the server; a restore or an applied fix rewrites the stored
 * body, which the tab-local editor picks up on its next open.
 */

const BASE = '/api/v1/docs';
const now = () => new Date().toISOString();
const denied = () => fail(403, 'forbidden', 'You do not have permission to do this');

function pageOf(db: MockDb, request: MockRequest) {
  const row = docsState(db).pages.find((item) => item.id === request.params['pageId']);
  return row && live(row) ? row : undefined;
}

function summary({ snapshot, ...revision }: MockRevision) {
  return { ...revision, wordCount: textOf(snapshot).split(/\s+/).filter(Boolean).length };
}

function record(
  db: MockDb,
  pageId: string,
  kind: MockRevision['kind'],
  snapshot: PmNode,
  label: string | null,
) {
  const state = historyState(db);
  const row = docsState(db).pages.find((item) => item.id === pageId)!;
  const number =
    Math.max(
      0,
      ...state.revisions.filter((rev) => rev.pageId === pageId).map((rev) => rev.number),
    ) + 1;
  const revision: MockRevision = {
    id: newId(),
    pageId,
    number,
    kind,
    label,
    title: row.title,
    snapshot: JSON.parse(JSON.stringify(snapshot)) as PmNode,
    authorIds: db.signedInAs ? [db.signedInAs] : [],
    createdBy: db.signedInAs,
    createdAt: now(),
  };
  state.revisions.push(revision);
  emit(db, 'docs.revisions', [pageId]);
  return revision;
}

const revisionRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${BASE}/pages/:pageId/revisions/compare`,
    handle: (request, db) => {
      const row = pageOf(db, request);
      if (!row) return notFound('Page');
      const side = (ref: string | null) => {
        if (!ref || ref === 'current') return { revision: null, snapshot: snapshotOf(row) };
        const revision = historyState(db).revisions.find(
          (rev) => rev.id === ref && rev.pageId === row.id,
        );
        return revision ? { revision, snapshot: revision.snapshot } : null;
      };
      const from = side(request.query.get('from'));
      const to = side(request.query.get('to'));
      if (!from || !to) return notFound('Revision');
      return ok({
        pageId: row.id,
        from: { revision: from.revision && summary(from.revision), title: row.title },
        to: { revision: to.revision && summary(to.revision), title: row.title },
        diff: diffDocs(from.snapshot, to.snapshot),
      });
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/pages/:pageId/revisions`,
    handle: (request, db) => {
      const rows = historyState(db).revisions.filter(
        (rev) => rev.pageId === request.params['pageId'],
      );
      return ok(page([...rows].sort((a, b) => b.number - a.number).map(summary), request));
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/pages/:pageId/revisions/:revisionId`,
    handle: (request, db) => {
      const revision = historyState(db).revisions.find(
        (rev) => rev.id === request.params['revisionId'],
      );
      return revision
        ? ok({ ...summary(revision), snapshot: revision.snapshot })
        : notFound('Revision');
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/pages/:pageId/revisions`,
    handle: (request, db) => {
      if (!can(db, 'docs.page.edit')) return denied();
      const row = pageOf(db, request);
      if (!row) return notFound('Page');
      const label = bodyOf<{ label: string }>(request).label?.trim() || null;
      return ok(summary(record(db, row.id, 'named', snapshotOf(row), label)), 201);
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/pages/:pageId/revisions/:revisionId/restore`,
    handle: (request, db) => {
      if (!can(db, 'docs.page.edit')) return denied();
      const row = pageOf(db, request);
      const revision = historyState(db).revisions.find(
        (rev) => rev.id === request.params['revisionId'],
      );
      if (!row || !revision) return notFound('Revision');
      writeBody(row, revision.snapshot);
      emit(db, 'docs.page', [row.id]);
      return ok(
        summary(
          record(db, row.id, 'restore', revision.snapshot, `Restored version ${revision.number}`),
        ),
      );
    },
  },
];

export const docsHistoryRoutes: MockRoute[] = [
  ...revisionRoutes,
  ...docsCommentRoutes,
  ...docsLinkRoutes,
  ...docsTransferRoutes,
];

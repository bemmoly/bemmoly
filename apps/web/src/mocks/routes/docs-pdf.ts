import { can, type MockDb } from '../db.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, fail, notFound, ok, type MockRoute } from '../types.ts';
import { docsState, live } from './docs-state.ts';

/*
 * PDF exports on the in-memory backend, when `?pdf=on` says the install runs the renderer.
 * A queued export is ready on its first read, and its file is a one-page PDF placeholder.
 */

const BASE = '/api/v1/docs';

interface MockExport {
  id: string;
  pageId: string;
  scope: 'page' | 'subtree';
  paper: 'a4' | 'letter';
  fileName: string;
  read: boolean;
}

const exports = new Map<string, MockExport>();

const PLACEHOLDER =
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';

const view = (row: MockExport, status: 'queued' | 'ready') => ({
  id: row.id,
  pageId: row.pageId,
  scope: row.scope,
  paper: row.paper,
  status,
  fileName: row.fileName,
  pages: 1,
  size: status === 'ready' ? PLACEHOLDER.length : null,
  downloadUrl: status === 'ready' ? `${BASE}/exports/${row.id}/file` : null,
  error: null,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
});

const renderer = (db: MockDb) => db.pdfRenderer === true;

export const docsPdfRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${BASE}/exports/options`,
    handle: (_request, db) => ok({ pdf: renderer(db) }),
  },
  {
    method: 'POST',
    pattern: `${BASE}/pages/:pageId/exports`,
    handle: (request, db) => {
      if (!renderer(db)) return notFound('PDF rendering');
      const page = docsState(db).pages.find(
        (item) => item.id === request.params['pageId'] && live(item),
      );
      if (!page) return notFound('Page');
      const input = bodyOf<{ scope: 'page' | 'subtree'; paper: 'a4' | 'letter' }>(request);
      const scope = input.scope ?? 'page';
      if (scope === 'subtree' && !can(db, 'docs.space.export')) {
        return fail(403, 'forbidden', 'You may not export this space');
      }
      const row: MockExport = {
        id: newId(),
        pageId: page.id,
        scope,
        paper: input.paper ?? 'a4',
        fileName: `${(page.title || 'untitled').toLowerCase().replace(/[^\w]+/g, '-')}.pdf`,
        read: false,
      };
      exports.set(row.id, row);
      return ok(view(row, 'queued'), 202);
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/exports/:exportId`,
    handle: (request) => {
      const row = exports.get(request.params['exportId'] ?? '');
      if (!row) return notFound('Export');
      row.read = true;
      return ok(view(row, 'ready'));
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/exports/:exportId/file`,
    handle: (request) => {
      const row = exports.get(request.params['exportId'] ?? '');
      if (!row) return notFound('Export');
      return {
        status: 200,
        body: PLACEHOLDER,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': `attachment; filename="${row.fileName}"`,
        },
      };
    },
  },
];

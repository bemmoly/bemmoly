import { can, emit, type MockDb } from '../db.ts';
import { bodyOf, fail, notFound, ok, type MockRoute } from '../types.ts';
import { docsState, live, presentSummary } from './docs-state.ts';

/*
 * Search, labels and the Docs home's "needs attention" on the in-memory
 * backend, in the Docs server's shapes; and the Docs pages ⌘K lists.
 */

const BASE = '/api/v1/docs';
const STALE_AFTER_DAYS = 90;
const STATUS: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In review',
  published: 'Published',
  archived: 'Archived',
};

function matches(db: MockDb, q: string, spaceId?: string | null) {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  return docsState(db).pages.filter(
    (row) =>
      live(row) &&
      (!spaceId || row.spaceId === spaceId) &&
      (row.title.toLowerCase().includes(query) || row.text.toLowerCase().includes(query)),
  );
}

/** "a flag flip" with the query marked as the server marks it. */
function snippet(text: string, q: string): string {
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return text.slice(0, 120);
  const start = Math.max(0, at - 40);
  return `${text.slice(start, at)}<b>${text.slice(at, at + q.length)}</b>${text.slice(at + q.length, at + q.length + 60)}`;
}

/** Docs pages for the mock's /api/v1/search, as the Docs palette provider answers. */
export function docsSearchHits(db: MockDb, q: string) {
  const state = docsState(db);
  return matches(db, q)
    .slice(0, 8)
    .map((row) => {
      const page = presentSummary(state, row);
      return {
        kind: 'docs.page',
        group: 'Pages',
        id: page.id,
        key: page.spaceKey,
        title: page.title || 'Untitled',
        subtitle: STATUS[page.status] ?? null,
        href: `/docs/p/${page.id}`,
      };
    });
}

export const docsFindRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${BASE}/search`,
    handle: (request, db) => {
      const state = docsState(db);
      const q = request.query.get('q') ?? '';
      const rows = matches(db, q, request.query.get('spaceId')).slice(
        0,
        Number(request.query.get('limit') ?? 20),
      );
      return ok({
        items: rows.map((row, index) => {
          const { id, spaceId, spaceKey, title, icon, status } = presentSummary(state, row);
          const rank = 1 / (index + 1);
          return {
            id,
            spaceId,
            spaceKey,
            title,
            icon,
            status,
            snippet: snippet(row.text, q),
            rank,
          };
        }),
      });
    },
  },
  {
    method: 'PUT',
    pattern: `${BASE}/pages/:pageId/labels`,
    handle: (request, db) => {
      if (!can(db, 'docs.page.edit')) {
        return fail(403, 'forbidden', 'You do not have permission to do this');
      }
      const row = docsState(db).pages.find(
        (item) => item.id === request.params['pageId'] && live(item),
      );
      if (!row) return notFound('The page');
      const seen = new Set<string>();
      row.labels = (bodyOf<{ labels: string[] }>(request).labels ?? [])
        .map((label) => label.trim())
        .filter(
          (label) => label && !seen.has(label.toLowerCase()) && seen.add(label.toLowerCase()),
        );
      emit(db, 'docs.page', [row.id]);
      return ok({ labels: row.labels });
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/labels`,
    handle: (request, db) => {
      const q = (request.query.get('q') ?? '').toLowerCase();
      const counts = new Map<string, number>();
      for (const row of docsState(db).pages.filter(live)) {
        for (const label of row.labels) counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      const items = [...counts]
        .filter(([name]) => name.toLowerCase().startsWith(q))
        .sort((a, b) => b[1] - a[1])
        .slice(0, Number(request.query.get('limit') ?? 10))
        .map(([name, pageCount]) => ({ name, pageCount }));
      return ok({ items });
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/home/attention`,
    handle: (request, db) => {
      const state = docsState(db);
      const me = db.signedInAs ?? '';
      const cutoff = Date.now() - STALE_AFTER_DAYS * 86_400_000;
      const reviews = state.pages
        .filter((row) => live(row) && row.status === 'in_review' && row.reviewers.includes(me))
        .map((row) => ({ kind: 'review', page: presentSummary(state, row), since: row.updatedAt }));
      const stale = state.pages
        .filter(
          (row) =>
            live(row) &&
            row.status === 'published' &&
            row.ownerId === me &&
            Date.parse(row.updatedAt) < cutoff,
        )
        .map((row) => ({ kind: 'stale', page: presentSummary(state, row), since: row.updatedAt }));
      const limit = Number(request.query.get('limit') ?? 10);
      return ok({
        items: [...reviews, ...stale].slice(0, limit),
        staleAfterDays: STALE_AFTER_DAYS,
      });
    },
  },
];

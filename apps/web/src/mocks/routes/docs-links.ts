import type { MockDb } from '../db.ts';
import type { MockPage } from '../seed/docs.ts';
import { uid } from '../seed/time.ts';
import { seedWorkStatuses } from '../seed/work-settings.ts';
import { notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import type { PmNode } from './docs-diff.ts';
import { snapshotOf } from './docs-history-state.ts';
import { docsState, live } from './docs-state.ts';
import { issueStore } from './work-issue-store.ts';

/*
 * The reference graph of the in-memory backend, read from the stored bodies: issue chips
 * and issue links a page holds, pages that link to a page, and issues that point back.
 * The RFC page is also referenced by two issues and two pages, as the mock's Linked tab.
 */

const BASE = '/api/v1/docs';
const RFC_PAGE = uid(5101);

function pageOf(db: MockDb, request: MockRequest) {
  const row = docsState(db).pages.find((item) => item.id === request.params['pageId']);
  return row && live(row) ? row : undefined;
}

/** Issue keys a body names: issue chips, and links to /work/issue/KEY. */
export function issueKeysOf(node: PmNode, keys = new Set<string>()): Set<string> {
  if (node.type === 'issueEmbed' && typeof node.attrs?.['key'] === 'string')
    keys.add(node.attrs['key']);
  for (const mark of node.marks ?? []) {
    const href = String(mark.attrs?.['href'] ?? '');
    const match = /\/work\/issue\/([A-Z][A-Z0-9]+-\d+)/.exec(href);
    if (match) keys.add(match[1]!);
  }
  (node.content ?? []).forEach((child) => issueKeysOf(child, keys));
  return keys;
}

/** The seeded workflow's statuses by id, for the status a linked issue carries. */
const STATUSES = new Map(seedWorkStatuses('').map((row) => [row.id, row]));

function issueRecord(db: MockDb, key: string) {
  const issue = issueStore(db).issues.find((row) => row['key'] === key);
  const status = STATUSES.get(String(issue?.['statusId']));
  return {
    kind: 'issue',
    id: String(issue?.id ?? uid(0x700000 + key.length)),
    key,
    title: String(issue?.['title'] ?? key),
    path: `/work/issue/${key}`,
    ...(status
      ? { data: { status: { name: status.name, category: status.category, color: status.color } } }
      : {}),
  };
}

function linkedPage(db: MockDb, row: MockPage, kind: 'mention' | 'embed' | 'linked') {
  const space = docsState(db).spaces.find((item) => item.id === row.spaceId);
  return {
    pageId: row.id,
    spaceKey: space?.key ?? 'DOC',
    title: row.title,
    icon: row.icon,
    status: row.status,
    kind,
  };
}

/** Pages whose body links to `pageId`, and for the RFC two seeded neighbours. */
function backlinksOf(db: MockDb, pageId: string) {
  const pages = docsState(db).pages.filter((row) => live(row) && row.id !== pageId);
  const linking = pages.filter((row) => JSON.stringify(snapshotOf(row)).includes(pageId));
  const seeded =
    pageId === RFC_PAGE ? pages.filter((row) => row.spaceId === pages[0]?.spaceId).slice(0, 2) : [];
  const unique = [...new Map([...linking, ...seeded].map((row) => [row.id, row])).values()];
  return unique.map((row) => linkedPage(db, row, linking.includes(row) ? 'mention' : 'linked'));
}

export const docsLinkRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${BASE}/pages/:pageId/links`,
    handle: (request, db) => {
      const row = pageOf(db, request);
      if (!row) return notFound('Page');
      const items = [...issueKeysOf(snapshotOf(row))].map((key) => {
        const record = issueRecord(db, key);
        const targetId = /^[0-9a-f-]{36}$/.test(record.id) ? record.id : uid(0x710000);
        return { targetKind: 'issue', targetId, kind: 'embed', page: null, record };
      });
      return ok({ items, nextCursor: null });
    },
  },
  {
    method: 'PUT',
    pattern: `${BASE}/pages/:pageId/links`,
    handle: (request, db) =>
      pageOf(db, request) ? ok({ items: [], nextCursor: null }) : notFound('Page'),
  },
  {
    method: 'GET',
    pattern: `${BASE}/pages/:pageId/backlinks`,
    handle: (request, db) => {
      const row = pageOf(db, request);
      return row ? ok({ items: backlinksOf(db, row.id), nextCursor: null }) : notFound('Page');
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/pages/:pageId/references`,
    handle: (request, db) => {
      const row = pageOf(db, request);
      if (!row) return notFound('Page');
      const keys = row.id === RFC_PAGE ? ['PLT-204', 'PLT-218'] : [];
      const items = keys.map((key, index) => ({
        ...issueRecord(db, key),
        linkKind: index === 0 ? 'linked' : 'mention',
      }));
      return ok({ items, nextCursor: null });
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/references`,
    handle: (request, db) => {
      const key = request.query.get('key');
      const pages = docsState(db).pages.filter(
        (row) => live(row) && key && issueKeysOf(snapshotOf(row)).has(key),
      );
      return ok({ items: pages.map((row) => linkedPage(db, row, 'embed')), nextCursor: null });
    },
  },
];

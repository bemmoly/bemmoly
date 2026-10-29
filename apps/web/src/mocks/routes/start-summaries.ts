import type { StartEntryInput, StartSummary } from '@bemmoly/shared';
import type { MockDb } from '../db.ts';
import { ok, type MockRoute } from '../types.ts';
import { docsState } from './docs-state.ts';
import { statuses } from './work-issue-detail.ts';
import { issueStore } from './work-issue-store.ts';
import { projectsOf } from './work-board-state.ts';

/*
 * The start page's summaries on the in-memory backend, by the rules the Work and Docs
 * `summaryForUser` sources follow on the server: open issues assigned to the person (due within
 * a week needs them), reviews asked of them and their pages that went stale.
 */

const LIMIT = 5;
const DAY = 86_400_000;
const STALE_DAYS = 90;

const entry = (input: StartEntryInput) => ({ at: null, ...input });

function work(db: MockDb, me: string): Omit<StartSummary, 'moduleId'> {
  const status = statuses(db);
  const projects = projectsOf(db);
  const open = issueStore(db)
    .issues.filter(
      (row) =>
        !row['deletedAt'] &&
        !row['archivedAt'] &&
        row['assigneeId'] === me &&
        status.get(String(row['statusId']))?.['category'] !== 'done',
    )
    .sort((a, b) => String(b['updatedAt']).localeCompare(String(a['updatedAt'])));
  const project = (row: (typeof open)[number]) =>
    String(projects.find((item) => item.id === row['projectId'])?.['name'] ?? '');
  const soon = Date.now() + 7 * DAY;
  const issue = (row: (typeof open)[number], context: string, at: string) =>
    entry({
      id: `issue:${String(row['key'])}`,
      title: String(row['title']),
      handle: String(row['key']),
      context,
      path: `/work/issue/${String(row['key'])}`,
      at: new Date(at).toISOString(),
    });
  return {
    waiting: {
      count: open.length,
      label: open.length === 1 ? 'issue assigned to you' : 'issues assigned to you',
    },
    needsYou: open
      .filter((row) => row['dueAt'] && Date.parse(String(row['dueAt'])) <= soon)
      .sort((a, b) => String(a['dueAt']).localeCompare(String(b['dueAt'])))
      .slice(0, LIMIT)
      .map((row) => issue(row, `Due · ${project(row)}`, String(row['dueAt']))),
    recent: open
      .slice(0, LIMIT)
      .map((row) =>
        issue(
          row,
          `${String(status.get(String(row['statusId']))?.['name'] ?? '')} · ${project(row)}`,
          String(row['updatedAt']),
        ),
      ),
  };
}

function docs(db: MockDb, me: string): Omit<StartSummary, 'moduleId'> {
  const state = docsState(db);
  const live = state.pages.filter((page) => !page.deletedAt);
  const spaceKey = (spaceId: string) =>
    state.spaces.find((space) => space.id === spaceId)?.key ?? '';
  const page = (row: (typeof live)[number], context: string, at: string) =>
    entry({
      id: `page:${row.id}`,
      title: row.title || 'Untitled',
      context,
      path: `/docs/p/${row.id}`,
      at,
    });
  const reviews = live.filter((row) => row.status === 'in_review' && row.reviewers.includes(me));
  const staleBefore = Date.now() - STALE_DAYS * DAY;
  const stale = live.filter(
    (row) =>
      row.status === 'published' &&
      row.ownerId === me &&
      Date.parse(row.contentUpdatedAt) < staleBefore,
  );
  return {
    waiting: {
      count: reviews.length,
      label: reviews.length === 1 ? 'page to review' : 'pages to review',
    },
    needsYou: [
      ...reviews.map((row) =>
        page(row, `Review requested · ${spaceKey(row.spaceId)}`, row.updatedAt),
      ),
      ...stale.map((row) =>
        page(row, `Due for a refresh · ${spaceKey(row.spaceId)}`, row.contentUpdatedAt),
      ),
    ].slice(0, LIMIT),
    recent: live
      .filter((row) => row.ownerId === me)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, LIMIT)
      .map((row) => page(row, spaceKey(row.spaceId), row.updatedAt)),
  };
}

const SOURCES: Record<string, (db: MockDb, me: string) => Omit<StartSummary, 'moduleId'>> = {
  work,
  docs,
};

export const startSummaryRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/start-summaries',
    handle: (_, db) => {
      const me = db.signedInAs ?? '';
      const items = db.manifests
        .filter((manifest) => manifest.id in SOURCES)
        .map((manifest) => ({ moduleId: manifest.id, ...SOURCES[manifest.id]!(db, me) }));
      return ok({ items });
    },
  },
];

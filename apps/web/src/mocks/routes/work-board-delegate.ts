import type { MockDb } from '../db.ts';
import type { MockRequest, MockResponse } from '../types.ts';
import { workIssuesRoutes } from './work-issues.ts';
import type { Row } from './work-state.ts';

/*
 * The board's routes answer first, and hand over to the issue mock (work-issues.ts) for the
 * issues, projects, labels and sprints it keeps, so the board and the Issue page read and
 * write the same rows wherever they overlap.
 */

const W = '/api/v1/work';

export function askIssueMock(
  method: string,
  pattern: string,
  request: Partial<MockRequest>,
  db: MockDb,
): MockResponse | null {
  const route = workIssuesRoutes.find(
    (entry) => entry.method === method && entry.pattern === `${W}${pattern}`,
  );
  if (!route) return null;
  return route.handle(
    {
      method,
      path: request.path ?? '',
      query: request.query ?? new URLSearchParams(),
      body: request.body,
      params: request.params ?? {},
    },
    db,
  );
}

const itemsOf = (response: MockResponse | null): Row[] =>
  response && response.status < 300
    ? ((response.body as { items?: Row[] } | undefined)?.items ?? [])
    : [];

/** The issue mock's projects (Platform Core and the others it lists). */
export const issueMockProjects = (db: MockDb) => itemsOf(askIssueMock('GET', '/projects', {}, db));

/** A project's sprints as the issue mock keeps them; the active one scopes a Scrum board. */
export const sprintsOf = (db: MockDb, projectKey: string) =>
  itemsOf(askIssueMock('GET', '/projects/:key/sprints', { params: { key: projectKey } }, db));

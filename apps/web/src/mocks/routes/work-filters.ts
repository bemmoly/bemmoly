import { currentUser, type MockDb } from '../db.ts';
import { TEAM_IDS, USER_IDS } from '../seed/people.ts';
import { ago, newId, uid } from '../seed/time.ts';
import { WORK_IDS } from '../seed/work-settings.ts';
import { bodyOf, fail, invalid, notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import { projectRef } from './work-board-state.ts';
import { compileLql } from './work-board-lql.ts';
import { lqlContext } from './work-board-view.ts';
import type { Row } from './work-state.ts';

/*
 * Saved LQL filters on the in-memory backend, answering /work/filters as the server does:
 * the caller sees their own and those shared with a team they are in; only the owner changes
 * or deletes one; the query must parse and validate. Kept per mock database like the issues.
 */

const W = '/api/v1/work/filters';
const states = new WeakMap<MockDb, Row[]>();

function filter(n: number, owner: string, name: string, query: string, teams: string[]): Row {
  return {
    id: uid(0x1f00 + n),
    ownerId: owner,
    projectId: WORK_IDS.project,
    name,
    query,
    sharedWith: teams,
    createdAt: ago(60 * 24 * 4),
    updatedAt: ago(60 * 24 * 4),
  };
}

function filters(db: MockDb): Row[] {
  let rows = states.get(db);
  if (!rows) {
    rows = [
      filter(1, USER_IDS.rohan, 'My open work', 'assignee = me AND status != Done', []),
      filter(2, USER_IDS.priya, 'Waiting for review', 'status = "Code review"', [
        TEAM_IDS.platform,
      ]),
    ];
    states.set(db, rows);
  }
  return rows;
}

const visible = (db: MockDb) => {
  const user = currentUser(db);
  return filters(db).filter(
    (row) =>
      row['ownerId'] === user?.id ||
      (row['sharedWith'] as string[]).some((team) => user?.teamIds.includes(team)),
  );
};

/** The LQL must parse and name known fields, as the server's check does before a write. */
function badQuery(db: MockDb, query: unknown) {
  if (typeof query !== 'string' || !query.trim()) return invalid('query', 'Write a query.');
  const compiled = compileLql(query, lqlContext(db));
  return compiled.ok ? null : invalid('query', compiled.error.message);
}

function owned(request: MockRequest, db: MockDb) {
  const row = visible(db).find((entry) => entry.id === request.params['id']);
  if (!row) return { error: notFound('The filter') };
  if (row['ownerId'] !== db.signedInAs) {
    return { error: fail(403, 'forbidden', 'Only the owner can change a filter') };
  }
  return { row };
}

export const workFilterRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: W,
    handle: (request, db) => {
      const ref = request.query.get('projectId');
      const project = ref ? projectRef(db, ref) : undefined;
      if (ref && !project) return notFound('Project');
      const scope = request.query.get('scope') ?? 'all';
      const items = visible(db)
        .filter((row) => !project || !row['projectId'] || row['projectId'] === project.id)
        .filter((row) => scope !== 'mine' || row['ownerId'] === db.signedInAs)
        .filter((row) => scope !== 'shared' || row['ownerId'] !== db.signedInAs)
        .sort((a, b) => String(a['name']).localeCompare(String(b['name'])));
      return ok({ items });
    },
  },
  {
    method: 'POST',
    pattern: W,
    handle: (request, db) => {
      const body = bodyOf<Row>(request);
      const name = String(body['name'] ?? '').trim();
      if (!name) return invalid('name', 'Give the filter a name.');
      const problem = badQuery(db, body['query']);
      if (problem) return problem;
      const project = body['projectId'] ? projectRef(db, String(body['projectId'])) : undefined;
      const now = new Date().toISOString();
      const row: Row = {
        id: newId(),
        ownerId: db.signedInAs,
        projectId: project?.id ?? null,
        name,
        query: String(body['query']).trim(),
        sharedWith: [...new Set((body['sharedWith'] as string[] | undefined) ?? [])],
        createdAt: now,
        updatedAt: now,
      };
      filters(db).push(row);
      return ok(row, 201);
    },
  },
  {
    method: 'PATCH',
    pattern: `${W}/:id`,
    handle: (request, db) => {
      const { row, error } = owned(request, db);
      if (!row) return error;
      const body = bodyOf<Row>(request);
      if (body['name'] !== undefined && !String(body['name']).trim())
        return invalid('name', 'Give the filter a name.');
      if (body['query'] !== undefined) {
        const problem = badQuery(db, body['query']);
        if (problem) return problem;
      }
      const name = body['name'] === undefined ? row['name'] : String(body['name']).trim();
      Object.assign(row, body, { name, updatedAt: new Date().toISOString() });
      return ok(row);
    },
  },
  {
    method: 'DELETE',
    pattern: `${W}/:id`,
    handle: (request, db) => {
      const { row, error } = owned(request, db);
      if (!row) return error;
      const list = filters(db);
      list.splice(list.indexOf(row), 1);
      return ok(undefined, 204);
    },
  },
];

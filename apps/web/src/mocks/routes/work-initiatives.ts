import { can, currentUser, type MockDb } from '../db.ts';
import { USER_IDS } from '../seed/people.ts';
import { ago, dayFromToday, newId, uid } from '../seed/time.ts';
import { bodyOf, fail, invalid, notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import { statuses } from './work-issue-detail.ts';
import { issueStore } from './work-issue-store.ts';
import { workState, type Row } from './work-state.ts';

/*
 * Initiatives on the in-memory backend, answering /work/initiatives as the server does: a
 * program of epics across projects with its rolled-up progress. Only people with "Manage
 * initiatives" change one; an archived one keeps its epics but takes no new ones. The seed is
 * one program over Platform Core's and Mobile App's epics, so its timeline crosses teams.
 */

const W = '/api/v1/work/initiatives';
const MANAGE = 'work.initiative.manage';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface MockInitiative extends Row {
  epicIds: string[];
}

const states = new WeakMap<MockDb, MockInitiative[]>();

const epicIdsByKey = (db: MockDb, keys: readonly string[]) =>
  keys.flatMap((key) => issueStore(db).issues.find((row) => row['key'] === key)?.id ?? []);

function initiatives(db: MockDb): MockInitiative[] {
  let rows = states.get(db);
  if (!rows) {
    rows = [
      {
        id: uid(0x1e01),
        name: 'Self-serve launch',
        description: 'Everything a team needs to sign up, pay and go mobile on its own.',
        ownerId: USER_IDS.priya,
        startAt: dayFromToday(-30),
        targetAt: dayFromToday(60),
        archivedAt: null,
        createdBy: USER_IDS.priya,
        createdAt: ago(60 * 24 * 20),
        updatedAt: ago(60 * 24 * 2),
        epicIds: epicIdsByKey(db, ['PLT-190', 'PLT-240', 'MOB-1']),
      },
    ];
    states.set(db, rows);
  }
  return rows;
}

/** The epics of an initiative, or null when there is no such initiative. */
export function initiativeEpicIds(db: MockDb, id: string): Set<string> | null {
  const row = initiatives(db).find((entry) => entry.id === id);
  return row ? new Set(row.epicIds) : null;
}

function present(db: MockDb, row: MockInitiative) {
  const status = statuses(db);
  const category = (issue: Row) =>
    String(status.get(String(issue['statusId']))?.['category'] ?? 'todo');
  const level = new Map(workState(db).issueTypes.map((type) => [type.id, String(type['level'])]));
  const live = issueStore(db).issues.filter((issue) => !issue['deletedAt'] && !issue['archivedAt']);
  const epics = live.filter((issue) => row.epicIds.includes(issue.id));
  const work = live.filter(
    (issue) =>
      row.epicIds.includes(String(issue['parentId'])) &&
      level.get(String(issue['typeId'])) === 'standard',
  );
  const points = (rows: readonly Row[]) =>
    rows.reduce((sum, issue) => sum + Number(issue['estimate'] ?? 0), 0);
  const done = work.filter((issue) => category(issue) === 'done');
  const fields: Row = { ...row };
  delete fields['epicIds'];
  return {
    ...fields,
    epics: {
      total: epics.length,
      done: epics.filter((epic) => category(epic) === 'done').length,
      hidden: 0,
    },
    progress: {
      total: work.length,
      done: done.length,
      inProgress: work.filter((issue) => category(issue) === 'in_progress').length,
      points: points(work),
      pointsDone: points(done),
    },
    projectIds: [...new Set(epics.map((epic) => String(epic['projectId'])))],
    canManage: can(db, MANAGE),
  };
}

const forbidden = () => fail(403, 'forbidden', 'Only people who manage initiatives change them.');

function badFields(body: Partial<Row>, current?: Row) {
  if (body['name'] !== undefined && !String(body['name'] ?? '').trim())
    return invalid('name', 'Name the initiative.');
  for (const field of ['startAt', 'targetAt'] as const) {
    const value = body[field];
    if (value !== undefined && value !== null && !DATE.test(String(value)))
      return invalid(field, 'Use a date like 2026-11-30.');
  }
  const start = body['startAt'] === undefined ? current?.['startAt'] : body['startAt'];
  const target = body['targetAt'] === undefined ? current?.['targetAt'] : body['targetAt'];
  if (start && target && String(start) > String(target))
    return invalid('startAt', 'An initiative starts on or before its target date');
  return null;
}

function list(request: MockRequest, db: MockDb) {
  const archived = request.query.get('archived') === 'true';
  const q = request.query.get('q')?.toLowerCase() ?? '';
  const items = initiatives(db)
    .filter((row) => Boolean(row['archivedAt']) === archived)
    .filter((row) => String(row['name']).toLowerCase().startsWith(q))
    .sort((a, b) => String(a['name']).localeCompare(String(b['name'])))
    .map((row) => present(db, row));
  return ok({ items, nextCursor: null });
}

function find(request: MockRequest, db: MockDb) {
  return initiatives(db).find((row) => row.id === request.params['id']);
}

function create(request: MockRequest, db: MockDb) {
  if (!can(db, MANAGE)) return forbidden();
  const body = bodyOf<Row>(request);
  if (!String(body['name'] ?? '').trim()) return invalid('name', 'Name the initiative.');
  const bad = badFields(body);
  if (bad) return bad;
  const now = new Date().toISOString();
  const row: MockInitiative = {
    id: newId(),
    name: String(body['name']).trim(),
    description: body['description'] ?? null,
    ownerId: body['ownerId'] ?? null,
    startAt: body['startAt'] ?? null,
    targetAt: body['targetAt'] ?? null,
    archivedAt: null,
    createdBy: currentUser(db)?.id ?? null,
    createdAt: now,
    updatedAt: now,
    epicIds: [...new Set((body['epicIds'] as string[] | undefined) ?? [])],
  };
  initiatives(db).push(row);
  return ok(present(db, row), 201);
}

function update(request: MockRequest, db: MockDb) {
  if (!can(db, MANAGE)) return forbidden();
  const row = find(request, db);
  if (!row) return notFound('The initiative');
  const body = bodyOf<Row>(request);
  const bad = badFields(body, row);
  if (bad) return bad;
  for (const field of ['name', 'description', 'ownerId', 'startAt', 'targetAt'])
    if (body[field] !== undefined) row[field] = body[field];
  row['updatedAt'] = new Date().toISOString();
  return ok(present(db, row));
}

const archiving = (archived: boolean) => (request: MockRequest, db: MockDb) => {
  if (!can(db, MANAGE)) return forbidden();
  const row = find(request, db);
  if (!row) return notFound('The initiative');
  row['archivedAt'] = archived ? new Date().toISOString() : null;
  return ok(present(db, row));
};

function linkEpic(request: MockRequest, db: MockDb) {
  if (!can(db, MANAGE)) return forbidden();
  const row = find(request, db);
  if (!row) return notFound('The initiative');
  if (row['archivedAt'])
    return fail(409, 'conflict', 'Unarchive the initiative before changing its epics');
  const epicId = String(bodyOf<Row>(request)['epicId'] ?? '');
  const epic = issueStore(db).issues.find((issue) => issue.id === epicId && !issue['deletedAt']);
  if (!epic) return notFound('The epic');
  const level = workState(db).issueTypes.find((type) => type.id === epic['typeId'])?.['level'];
  if (level !== 'epic')
    return invalid(
      'epicId',
      `${String(epic['key'])} is not an epic; only epics join an initiative`,
    );
  if (row.epicIds.includes(epicId))
    return fail(409, 'conflict', `${String(epic['key'])} is already in ${String(row['name'])}`);
  row.epicIds.push(epicId);
  return ok(present(db, row), 201);
}

function unlinkEpic(request: MockRequest, db: MockDb) {
  if (!can(db, MANAGE)) return forbidden();
  const row = find(request, db);
  if (!row) return notFound('The initiative');
  if (row['archivedAt'])
    return fail(409, 'conflict', 'Unarchive the initiative before changing its epics');
  const before = row.epicIds.length;
  row.epicIds = row.epicIds.filter((id) => id !== request.params['epicId']);
  return row.epicIds.length === before ? notFound('The epic in this initiative') : ok();
}

export const workInitiativeRoutes: MockRoute[] = [
  { method: 'GET', pattern: W, handle: list },
  { method: 'POST', pattern: W, handle: create },
  {
    method: 'GET',
    pattern: `${W}/:id`,
    handle: (request, db) => {
      const row = find(request, db);
      return row ? ok(present(db, row)) : notFound('The initiative');
    },
  },
  { method: 'PATCH', pattern: `${W}/:id`, handle: update },
  { method: 'POST', pattern: `${W}/:id/archive`, handle: archiving(true) },
  { method: 'POST', pattern: `${W}/:id/unarchive`, handle: archiving(false) },
  { method: 'POST', pattern: `${W}/:id/epics`, handle: linkEpic },
  { method: 'DELETE', pattern: `${W}/:id/epics/:epicId`, handle: unlinkEpic },
];

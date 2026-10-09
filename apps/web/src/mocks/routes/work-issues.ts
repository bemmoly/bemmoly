import { emit, type MockDb } from '../db.ts';
import { newId } from '../seed/time.ts';
import * as seed from '../seed/work-issues.ts';
import { bodyOf, fail, invalid, notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import { issueActivityRoutes, type IssuesState } from './work-issue-activity.ts';
import { touch, workState, type Row } from './work-state.ts';

/*
 * The Issue page, the create form and the project list on the in-memory backend, by key as
 * the server's routes are. Rows live beside the kernel's mock database, like the settings
 * rows, so a scenario reset starts them over.
 */
const states = new WeakMap<MockDb, IssuesState>();

function state(db: MockDb): IssuesState {
  let current = states.get(db);
  if (!current) {
    current = {
      projects: seed.seedProjects(),
      issues: seed.seedIssues(),
      links: seed.seedLinks(),
      comments: seed.seedComments(),
      history: seed.seedHistory(),
      workLogs: seed.seedWorkLogs(),
      watchers: { [seed.issueId(204)]: [...seed.WATCHER_IDS] },
      labels: seed.seedLabels(),
      versions: seed.seedVersions(),
      sprints: seed.seedSprints(),
      counters: { [workState(db).project.id]: seed.LAST_NUMBER },
    };
    states.set(db, current);
  }
  return current;
}

const allProjects = (db: MockDb) => [workState(db).project, ...state(db).projects];
const projectOf = (db: MockDb, keyOrId = '') =>
  allProjects(db).find((row) => row['key'] === keyOrId.toUpperCase() || row.id === keyOrId);
const issueOf = (db: MockDb, key = '') =>
  state(db).issues.find((row) => row['key'] === key.toUpperCase() && !row['deletedAt']);
const byId = (rows: Row[], id: unknown) => rows.find((row) => row.id === id);
const of = (request: MockRequest, name: string) => request.params[name] ?? '';

function statuses(db: MockDb) {
  return new Map(
    workState(db)
      .workflows.flatMap((flow) => flow['statuses'] as Row[])
      .map((status) => [status.id, status]),
  );
}

const ref = (row: Row | undefined) => (row ? { id: row.id, name: String(row['name']) } : null);
const issueRef = ({ id, key, title, statusId, typeId }: Row) => ({
  id,
  key,
  title,
  statusId,
  typeId,
});
function person(db: MockDb, id: unknown) {
  const user = db.users.find((entry) => entry.id === id);
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

/** The detail response: the issue and every name the page prints beside a field. */
function detail(db: MockDb, issue: Row) {
  const s = state(db);
  const type = byId(workState(db).issueTypes, issue['typeId']);
  const status = statuses(db).get(String(issue['statusId']));
  const sprint = byId(s.sprints, issue['sprintId']);
  const links = s.links
    .filter((link) => link['sourceId'] === issue.id || link['targetId'] === issue.id)
    .flatMap((link) => {
      const inverse = link['targetId'] === issue.id;
      const other = byId(s.issues, inverse ? link['sourceId'] : link['targetId']);
      return other ? [{ id: link.id, kind: link['kind'], inverse, issue: issueRef(other) }] : [];
    });
  const watchers = s.watchers[issue.id] ?? [];
  return {
    ...issue,
    type: { ...ref(type), key: type?.['key'], level: type?.['level'], icon: type?.['icon'] },
    status: { ...ref(status), category: status?.['category'], color: status?.['color'] ?? null },
    assignee: person(db, issue['assigneeId']),
    reporter: person(db, issue['reporterId']),
    parent: issue['parentId'] ? issueRef(byId(s.issues, issue['parentId']) as Row) : null,
    sprint: sprint ? { ...ref(sprint), state: sprint['state'] } : null,
    fixVersion: ref(byId(s.versions, issue['fixVersionId'])),
    labels: (issue['labelIds'] as string[]).flatMap((id) => {
      const label = byId(s.labels, id);
      return label ? [{ ...ref(label), color: label['color'] }] : [];
    }),
    links,
    subtasks: s.issues
      .filter((row) => row['parentId'] === issue.id && !row['deletedAt'])
      .map(issueRef),
    watchersCount: watchers.length,
    watching: watchers.includes(db.signedInAs ?? ''),
  };
}

/** One history row per changed field, as the server writes them. */
function record(db: MockDb, issue: Row, field: string, from: unknown, to: unknown) {
  state(db).history.push({
    id: newId(),
    issueId: issue.id,
    actorId: db.signedInAs,
    field,
    from: from ?? null,
    to: to ?? null,
    aiPlanId: null,
    createdAt: new Date().toISOString(),
  });
}

function createIssue(request: MockRequest, db: MockDb) {
  const body = bodyOf<Row>(request);
  const project = projectOf(db, String(body['projectId'] ?? ''));
  if (!project) return invalid('projectId', 'Choose a project.');
  const title = String(body['title'] ?? '').trim();
  if (!title) return invalid('title', 'Give the issue a title.');
  if (!byId(workState(db).issueTypes, body['typeId'])) return invalid('typeId', 'Choose a type.');
  const s = state(db);
  const number = (s.counters[project.id] ?? 0) + 1;
  s.counters[project.id] = number;
  const now = new Date().toISOString();
  const first = workState(db).workflows[0]?.['statuses'] as Row[];
  const issue: Row = {
    description: null,
    priority: 'medium',
    assigneeId: null,
    parentId: null,
    sprintId: null,
    estimate: null,
    dueAt: null,
    fixVersionId: null,
    componentId: null,
    customFields: {},
    labelIds: [],
    ...body,
    id: newId(),
    projectId: project.id,
    number,
    key: `${String(project['key'])}-${number}`,
    title,
    descriptionText: '',
    statusId: first[0]?.id,
    reporterId: db.signedInAs,
    rank: 'z',
    statusChangedAt: now,
    resolvedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  s.issues.push(issue);
  emit(db, 'work.issue.created', [issue.id]);
  return ok(issue, 201);
}

function createProject(request: MockRequest, db: MockDb) {
  const body = bodyOf<Row>(request);
  const key = String(body['key'] ?? '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) {
    return invalid('key', 'Keys are 2 to 10 capital letters or digits');
  }
  if (projectOf(db, key)) return fail(409, 'conflict', `A project with the key ${key} exists`);
  const name = String(body['name'] ?? '').trim();
  if (!name) return invalid('name', 'Give the project a name.');
  const now = new Date().toISOString();
  const project: Row = {
    id: newId(),
    key,
    name,
    description: body['description'] ?? null,
    teamId: body['teamId'] ?? null,
    method: body['method'] ?? 'scrum',
    schemeOverrides: {},
    defaultSpaceId: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  state(db).projects.push(project);
  state(db).counters[project.id] = 0;
  emit(db, 'work.project.created', [project.id]);
  return ok(project, 201);
}

/** Routes for a project's catalog, by key; org rows and the project's own both show. */
function catalog(path: string, rows: (db: MockDb) => Row[]): MockRoute {
  return {
    method: 'GET',
    pattern: `/api/v1/work/projects/:key/${path}`,
    handle: (request, db) => {
      const project = projectOf(db, of(request, 'key'));
      if (!project) return notFound('Project');
      return ok({
        items: rows(db).filter((row) => !row['projectId'] || row['projectId'] === project.id),
      });
    },
  };
}

const issueRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/work/projects',
    handle: (_, db) => ok({ items: allProjects(db), nextCursor: null }),
  },
  { method: 'POST', pattern: '/api/v1/work/projects', handle: createProject },
  catalog('issue-types', (db) => workState(db).issueTypes),
  catalog('fields', (db) => workState(db).fields),
  catalog('labels', (db) => state(db).labels),
  catalog('versions', (db) => state(db).versions),
  catalog('sprints', (db) => state(db).sprints),
  {
    method: 'GET',
    pattern: '/api/v1/work/projects/:key/issue-types/:id/fields',
    handle: (request, db) =>
      ok({
        items: workState(db).typeFields.filter((row) => row['issueTypeId'] === of(request, 'id')),
      }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/work/workflows',
    handle: (request, db) => {
      const projectId = request.query.get('projectId');
      return ok({
        items: workState(db).workflows.filter(
          (flow) => !flow['projectId'] || flow['projectId'] === projectId,
        ),
      });
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/work/issues',
    handle: (request, db) => {
      const parentId = request.query.get('parentId');
      const projectId = request.query.get('projectId');
      const items = state(db).issues.filter(
        (row) =>
          !row['deletedAt'] &&
          (!parentId || row['parentId'] === parentId) &&
          (!projectId || row['projectId'] === projectId),
      );
      return ok({ items, nextCursor: null });
    },
  },
  { method: 'POST', pattern: '/api/v1/work/issues', handle: createIssue },
  {
    method: 'GET',
    pattern: '/api/v1/work/issues/:key',
    handle: (request, db) => {
      const issue = issueOf(db, of(request, 'key'));
      return issue ? ok(detail(db, issue)) : notFound('Issue');
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/work/issues/:key',
    handle: (request, db) => {
      const issue = issueOf(db, of(request, 'key'));
      if (!issue) return notFound('Issue');
      const body = bodyOf<Row>(request);
      if (body['title'] !== undefined && !String(body['title']).trim()) {
        return invalid('title', 'Give the issue a title.');
      }
      for (const [field, value] of Object.entries(body)) {
        if (JSON.stringify(issue[field]) !== JSON.stringify(value)) {
          record(db, issue, field, issue[field], value);
        }
      }
      if (body['statusId'] && body['statusId'] !== issue['statusId']) {
        body['statusChangedAt'] = new Date().toISOString();
      }
      touch(issue, body);
      emit(db, 'work.issue.updated', [issue.id]);
      return ok(issue);
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/work/issues/:key',
    handle: (request, db) => {
      const issue = issueOf(db, of(request, 'key'));
      if (!issue) return notFound('Issue');
      touch(issue, { deletedAt: new Date().toISOString() });
      return ok();
    },
  },
];

export const workIssuesRoutes: MockRoute[] = [
  ...issueRoutes,
  ...issueActivityRoutes({ state, issueOf, statuses }),
];

import { can, emit, type MockDb } from '../db.ts';
import { newId } from '../seed/time.ts';
import { backlogIssue, type BacklogIssueRow, type BacklogSprintRow } from '../seed/work-backlog.ts';
import { WORK_IDS } from '../seed/work-settings.ts';
import { bodyOf, fail, invalid, notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import {
  backlogResponse,
  backlogState,
  byRank,
  projectMatches,
  renumber,
  unfinishedOf,
} from './work-backlog-state.ts';
import { workIssuesRoutes } from './work-issues.ts';

/*
 * The Backlog screen's routes: the one-call read, the drop, inline create and
 * the sprint lifecycle, answering in the work module's shared schemas.
 */

const EDIT = 'work.issue.edit';
const denied = () => fail(403, 'forbidden', 'You need "Create and edit issues" to do that.');
const conflict = (message: string) => fail(409, 'conflict', message);

interface MoveBody {
  beforeIssueId: string | null;
  afterIssueId: string | null;
  sprintId: string | null;
}

function changed(db: MockDb, ids: string[]) {
  emit(db, 'work.issue.updated', ids);
}

function move(db: MockDb, key: string, body: Partial<MoveBody>) {
  const state = backlogState(db);
  const issue = state.issues.find((row) => row.key === key && !row.deletedAt);
  if (!issue) return notFound(`Issue ${key}`);
  if (body.sprintId) {
    const sprint = state.sprints.find((row) => row.id === body.sprintId);
    if (!sprint) return invalid('sprintId', 'The sprint is not part of this project');
    if (sprint.state === 'closed') return invalid('sprintId', 'The sprint is closed');
  }
  const ordered = state.issues.filter((row) => row !== issue).sort(byRank);
  const above = ordered.findIndex((row) => row.id === body.beforeIssueId);
  const below = ordered.findIndex((row) => row.id === body.afterIssueId);
  if ((body.beforeIssueId && above < 0) || (body.afterIssueId && below < 0)) {
    return invalid('beforeIssueId', 'A neighbour is not an issue of this project');
  }
  const at = above >= 0 ? above + 1 : below >= 0 ? below : ordered.length;
  ordered.splice(at, 0, issue);
  renumber(ordered);
  if (body.sprintId !== undefined) issue.sprintId = body.sprintId;
  issue.updatedAt = new Date().toISOString();
  changed(db, [issue.id]);
  return ok(issue);
}

/** The Issue page's create, so the slide-over and the Issue page know every new issue. */
const issueCreate = workIssuesRoutes.find(
  (route) => route.method === 'POST' && route.pattern === '/api/v1/work/issues',
);

/**
 * Creates through the issue mock and mirrors the new row into the backlog's
 * own rows, which the issue mock does not share: one numbering for both, so
 * the key a row shows is the key the slide-over opens.
 */
function createIssue(request: MockRequest, db: MockDb) {
  const result = issueCreate?.handle(request, db);
  if (!result || result.status !== 201) return result ?? invalid('title', 'Not created');
  const created = result.body as BacklogIssueRow;
  const state = backlogState(db);
  const last = [...state.issues].sort(byRank).at(-1);
  state.issues.push(backlogIssue({ ...created, rank: `${last?.rank ?? ''}n` }));
  /** Appending a letter per create would outgrow the 255-character rank; renumber instead. */
  renumber(state.issues.sort(byRank));
  return result;
}

function sprintRoute(
  method: MockRoute['method'],
  suffix: string,
  act: (sprint: BacklogSprintRow, db: MockDb, body: Record<string, unknown>) => unknown,
): MockRoute {
  return {
    method,
    pattern: `/api/v1/work/sprints/:id${suffix}`,
    handle: (request, db) => {
      if (method !== 'GET' && !can(db, EDIT)) return denied();
      const sprint = backlogState(db).sprints.find((row) => row.id === request.params['id']);
      if (!sprint) return notFound('Sprint');
      const result = act(sprint, db, bodyOf<Record<string, unknown>>(request));
      if (result && typeof result === 'object' && 'status' in result) return result as never;
      emit(db, 'work.sprint.updated', [sprint.id]);
      return result === undefined ? ok() : ok(result);
    },
  };
}

function start(sprint: BacklogSprintRow, db: MockDb, body: Record<string, unknown>) {
  if (sprint.state !== 'future') return conflict(`${sprint.name} has already started`);
  const running = backlogState(db).sprints.find((row) => row.state === 'active');
  if (running) return conflict(`${running.name} is still active; close it first`);
  const startsAt = (body['startsAt'] as string | undefined) ?? sprint.startsAt;
  const endsAt = (body['endsAt'] as string | undefined) ?? sprint.endsAt;
  const now = new Date().toISOString();
  const from = startsAt ?? now;
  const to = endsAt ?? new Date(Date.parse(from) + 14 * 86_400_000).toISOString();
  if (Date.parse(to) <= Date.parse(from)) return invalid('endsAt', 'A sprint ends after it starts');
  return Object.assign(sprint, {
    state: 'active',
    startedAt: now,
    startsAt: from,
    endsAt: to,
    updatedAt: now,
  });
}

function complete(sprint: BacklogSprintRow, db: MockDb, body: Record<string, unknown>) {
  if (sprint.state !== 'active') return conflict(`${sprint.name} is not active`);
  const state = backlogState(db);
  const choice = (body['moveUnfinishedTo'] as string | undefined) ?? 'backlog';
  const future = state.sprints.filter((row) => row.state === 'future');
  const target =
    choice === 'backlog'
      ? null
      : choice === 'next'
        ? (future[0]?.id ?? undefined)
        : future.find((row) => row.id === choice)?.id;
  if (target === undefined) return invalid('moveUnfinishedTo', 'That sprint cannot take the work');
  const unfinished = unfinishedOf(db, sprint.id);
  for (const issue of unfinished) issue.sprintId = target;
  const held = state.issues.filter((issue) => issue.sprintId === sprint.id);
  const sum = (list: typeof held) =>
    list.reduce((total, issue) => total + (issue.estimate ?? 0), 0);
  const now = new Date().toISOString();
  return Object.assign(sprint, {
    state: 'closed',
    closedAt: now,
    updatedAt: now,
    completedSnapshot: {
      committedPoints: sum(held) + sum(unfinished),
      completedPoints: sum(held),
      committedIssues: held.length + unfinished.length,
      completedIssues: held.length,
      carriedOverTo: target,
      issues: [],
    },
  });
}

export const workBacklogRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/work/projects/:key/backlog',
    handle: (request, db) =>
      projectMatches(request.params['key']) ? ok(backlogResponse(db)) : notFound('Project'),
  },
  {
    method: 'POST',
    pattern: '/api/v1/work/issues/:key/move',
    handle: (request, db) =>
      can(db, EDIT) ? move(db, request.params['key'] ?? '', bodyOf<MoveBody>(request)) : denied(),
  },
  {
    method: 'POST',
    pattern: '/api/v1/work/issues',
    handle: (request, db) => (can(db, EDIT) ? createIssue(request, db) : denied()),
  },
  {
    method: 'POST',
    pattern: '/api/v1/work/projects/:key/sprints',
    handle: (request, db) => {
      if (!can(db, EDIT)) return denied();
      if (!projectMatches(request.params['key'])) return notFound('Project');
      const body = bodyOf<BacklogSprintRow>(request);
      if (!body.name?.trim()) return invalid('name', 'A name is required');
      const now = new Date().toISOString();
      const sprint: BacklogSprintRow = {
        id: newId(),
        projectId: WORK_IDS.project,
        name: body.name.trim(),
        goal: body.goal ?? null,
        startsAt: body.startsAt ?? null,
        endsAt: body.endsAt ?? null,
        state: 'future',
        capacityPoints: body.capacityPoints ?? null,
        completedSnapshot: null,
        startedAt: null,
        closedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      backlogState(db).sprints.push(sprint);
      emit(db, 'work.sprint.created', [sprint.id]);
      return ok(sprint, 201);
    },
  },
  sprintRoute('GET', '', (sprint) => sprint),
  sprintRoute('PATCH', '', (sprint, _, body) =>
    sprint.state === 'closed'
      ? conflict('A closed sprint cannot change')
      : Object.assign(sprint, body, { updatedAt: new Date().toISOString() }),
  ),
  sprintRoute('DELETE', '', (sprint, db) => {
    if (sprint.state !== 'future') {
      return conflict('Only a sprint that has not started can be deleted');
    }
    const state = backlogState(db);
    for (const issue of state.issues) if (issue.sprintId === sprint.id) issue.sprintId = null;
    state.sprints = state.sprints.filter((row) => row !== sprint);
    return undefined;
  }),
  sprintRoute('POST', '/start', start),
  sprintRoute('POST', '/complete', complete),
];

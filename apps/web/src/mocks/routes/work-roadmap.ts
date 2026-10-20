import { can, emit, type MockDb } from '../db.ts';
import { THROUGHPUT } from '../seed/work-roadmap.ts';
import { bodyOf, fail, invalid, notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import { projectsOf } from './work-board-state.ts';
import { statuses } from './work-issue-detail.ts';
import { linksOf, versionsOf } from './work-issues.ts';
import { issueStore } from './work-issue-store.ts';
import {
  dayOf,
  mockForecast,
  type MockForecast,
  type MockForecastItem,
} from './work-roadmap-forecast.ts';
import { PROJECT_CONFIGURE, touch, workState, type Row } from './work-state.ts';

/*
 * GET /work/roadmap and PATCH /projects/:key/versions/:id on the in-memory backend, shaped as
 * the server's roadmap service answers: epics and live versions of the projects in view, their
 * progress and bars, the epic-level "blocks" links and a forecast for each. Epic dates move
 * through the issue mock's PATCH, so the Issue page and the Board see them too.
 */

const W = '/api/v1/work';
const today = () => Math.floor(Date.now() / 86_400_000);
const str = (value: unknown) => (typeof value === 'string' && value ? value : null);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface Built {
  item: Row;
  input: MockForecastItem;
}

function progressOf(work: readonly Row[], category: (row: Row) => string) {
  const points = (rows: readonly Row[]) =>
    rows.reduce((sum, row) => sum + Number(row['estimate'] ?? 0), 0);
  const done = work.filter((row) => category(row) === 'done');
  return {
    total: work.length,
    done: done.length,
    inProgress: work.filter((row) => category(row) === 'in_progress').length,
    points: points(work),
    pointsDone: points(done),
  };
}

function peopleOf(work: readonly Row[], category: (row: Row) => string): string[] {
  const counts = new Map<string, number>();
  for (const row of work) {
    const who = str(row['assigneeId']);
    if (who && category(row) !== 'done') counts.set(who, (counts.get(who) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);
}

function view(request: MockRequest, db: MockDb) {
  const keys = request.query.get('projects')?.split(',').filter(Boolean) ?? null;
  const teamId = request.query.get('teamId');
  const all = projectsOf(db).filter((project) => !project['archivedAt']);
  const missing = (keys ?? []).filter(
    (key) => !all.some((project) => project['key'] === key.toUpperCase()),
  );
  if (missing.length > 0)
    return fail(404, 'not_found', `There is no project ${missing.join(', ')}`);
  const projects = all.filter(
    (project) =>
      (!keys || keys.some((key) => key.toUpperCase() === project['key'])) &&
      (!teamId || project['teamId'] === teamId),
  );
  const ids = new Set(projects.map((project) => project.id));
  const status = statuses(db);
  const category = (row: Row) =>
    String(status.get(String(row['statusId']))?.['category'] ?? 'todo');
  const level = new Map(workState(db).issueTypes.map((type) => [type.id, String(type['level'])]));
  const issues = issueStore(db).issues.filter(
    (row) => !row['deletedAt'] && !row['archivedAt'] && ids.has(String(row['projectId'])),
  );
  const standard = issues.filter((row) => level.get(String(row['typeId'])) === 'standard');
  const name = (projectId: unknown) =>
    String(projects.find((p) => p.id === projectId)?.['name'] ?? '');
  const now = today();
  const configure = can(db, PROJECT_CONFIGURE);
  const built: Built[] = [];
  for (const epic of issues.filter((row) => level.get(String(row['typeId'])) === 'epic')) {
    const work = standard.filter((row) => row['parentId'] === epic.id);
    const fields = (epic['customFields'] ?? {}) as Row;
    const target = DATE.test(String(fields['target_date']))
      ? String(fields['target_date'])
      : str(epic['dueAt']);
    const start = str(epic['startAt']);
    const open = work.filter((row) => category(row) !== 'done');
    built.push({
      item: {
        id: epic.id,
        kind: 'epic',
        projectId: epic['projectId'],
        key: epic['key'],
        title: epic['title'],
        color: str(epic['color']),
        statusCategory: category(epic),
        versionStatus: null,
        startAt: start,
        endAt: target,
        targetField: 'target_date',
        ownerId: str(fields['owner']),
        start: start && target && start > target ? null : start,
        end: target,
        progress: progressOf(work, category),
        assigneeIds: peopleOf(work, category),
        canSchedule: true,
        children: work.slice(0, 100).map((row) => ({
          id: row.id,
          key: row['key'],
          title: row['title'],
          typeId: row['typeId'],
          statusName: String(status.get(String(row['statusId']))?.['name'] ?? ''),
          statusCategory: category(row),
          assigneeId: str(row['assigneeId']),
          estimate: row['estimate'] ?? null,
          startAt: str(row['startAt']),
          dueAt: str(row['dueAt']),
        })),
      },
      input: {
        id: epic.id,
        kind: 'epic',
        title: String(epic['title']),
        done: category(epic) === 'done',
        total: work.length,
        remaining: open.length,
        started:
          work.some((row) => category(row) !== 'todo') || (start !== null && dayOf(start) <= now),
        startDay: start ? dayOf(start) : null,
        targetDay: target ? dayOf(target) : null,
        sharedWith: 0,
        project: name(epic['projectId']),
        samples: THROUGHPUT[String(epic['projectId'])],
      },
    });
  }
  for (const version of versionsOf(db).filter(
    (row) => ids.has(String(row['projectId'])) && row['status'] !== 'archived',
  )) {
    const work = standard.filter((row) => row['fixVersionId'] === version.id);
    const release = str(version['releaseAt']);
    built.push({
      item: {
        id: version.id,
        kind: 'version',
        projectId: version['projectId'],
        key: null,
        title: version['name'],
        color: null,
        statusCategory: null,
        versionStatus: version['status'],
        startAt: str(version['startAt']),
        endAt: release,
        targetField: 'releaseAt',
        ownerId: null,
        start: str(version['startAt']),
        end: release,
        progress: progressOf(work, category),
        assigneeIds: peopleOf(work, category),
        canSchedule: configure,
        children: [],
      },
      input: {
        id: version.id,
        kind: 'version',
        title: String(version['name']),
        done: version['status'] === 'released',
        total: work.length,
        remaining: work.filter((row) => category(row) !== 'done').length,
        started: false,
        startDay: null,
        targetDay: release ? dayOf(release) : null,
        sharedWith: 0,
        project: name(version['projectId']),
        samples: THROUGHPUT[String(version['projectId'])],
      },
    });
  }
  const inFlight = new Map<string, number>();
  for (const { input, item } of built)
    if (input.kind === 'epic' && !input.done && input.started && input.remaining > 0)
      inFlight.set(String(item['projectId']), (inFlight.get(String(item['projectId'])) ?? 0) + 1);
  const known = new Set(built.map(({ item }) => item.id));
  const dependencies = linksOf(db)
    .filter(
      (link) =>
        link['kind'] === 'blocks' &&
        known.has(String(link['sourceId'])) &&
        known.has(String(link['targetId'])),
    )
    .map((link) => ({
      id: link.id,
      fromId: String(link['sourceId']),
      toId: String(link['targetId']),
    }));
  const ends = new Map<string, [number, number, number]>();
  const forecasts = new Map<string, MockForecast>();
  // Blockers first: one pass per level of the dependency chain is enough for the seeded plan.
  const order = [...built].sort(
    (a, b) =>
      Number(dependencies.some((d) => d.toId === a.item.id)) -
      Number(dependencies.some((d) => d.toId === b.item.id)),
  );
  for (const { input, item } of order) {
    input.sharedWith =
      input.kind === 'epic' ? Math.max(0, (inFlight.get(String(item['projectId'])) ?? 0) - 1) : 0;
    const blockers = dependencies.flatMap((d) => {
      const at = ends.get(d.fromId);
      const from = built.find((entry) => entry.item.id === d.fromId);
      return d.toId === item.id && at && from
        ? [{ id: d.fromId, title: from.input.title, ends: at }]
        : [];
    });
    const result = mockForecast(input, blockers, now);
    forecasts.set(item.id, result.forecast);
    if (result.ends) ends.set(item.id, result.ends);
  }
  return ok({
    today: new Date(now * 86_400_000).toISOString().slice(0, 10),
    projects: projects.map((project) => ({
      id: project.id,
      key: project['key'],
      name: project['name'],
      teamId: project['teamId'] ?? null,
      method: project['method'],
      history: THROUGHPUT[project.id]
        ? { basis: 'throughput', unit: 'issues', samples: THROUGHPUT[project.id], periodDays: 7 }
        : null,
    })),
    teams: db.teams
      .filter((team) => projects.some((project) => project['teamId'] === team.id))
      .map((team) => ({ id: team.id, name: team.name })),
    items: built.map(({ item }) => ({ ...item, forecast: forecasts.get(item.id) })),
    dependencies,
    computedAt: new Date().toISOString(),
  });
}

function patchVersion(request: MockRequest, db: MockDb) {
  if (!can(db, PROJECT_CONFIGURE))
    return fail(403, 'forbidden', 'Only project admins change versions.');
  const version = versionsOf(db).find((row) => row.id === request.params['id']);
  if (!version) return notFound('Version');
  const body = bodyOf<Row>(request);
  const start = body['startAt'] === undefined ? version['startAt'] : body['startAt'];
  const release = body['releaseAt'] === undefined ? version['releaseAt'] : body['releaseAt'];
  if (start && release && String(start) > String(release)) {
    return invalid('startAt', 'A version starts on or before its release date');
  }
  touch(version, body);
  emit(db, 'work.issue', [version.id]);
  return ok(version);
}

export const workRoadmapRoutes: MockRoute[] = [
  { method: 'GET', pattern: `${W}/roadmap`, handle: view },
  { method: 'PATCH', pattern: `${W}/projects/:key/versions/:id`, handle: patchVersion },
];

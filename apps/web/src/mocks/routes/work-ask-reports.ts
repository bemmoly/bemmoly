import { currentUser, type MockDb } from '../db.ts';
import { bodyOf, fail, notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import { aiEnabledFor, workspaceAiOn } from './ai-state.ts';
import {
  DAY,
  isDone,
  points,
  reportContext,
  round,
  sprintRows,
  type ReportContext,
} from './work-reports-data.ts';
import { bucketsOf } from './work-reports-more.ts';
import type { Row } from './work-state.ts';

/*
 * Asked and pinned reports in the mock backend and the public demo, on the server's paths
 * and in modules/work/shared/ask-reports.ts's shapes. A few keyword rules stand in for the
 * model, picking a spec the way the prompt asks it to; the spec then runs over the demo's
 * real issues. Pins live with the mock database, one list per person.
 */

const W = '/api/v1/work';

interface Spec {
  title: string;
  metric: string;
  groupBy: string;
  filters: { status?: string; sprint?: string; assignee?: string };
  chart: string;
}

/** The stand-in for the model: the questions the screen suggests, and a fallback. */
export function specFor(question: string): Spec {
  const text = question.toLowerCase();
  const sprint = /current sprint|this sprint|active sprint/.test(text) ? { sprint: 'active' } : {};
  if (/time to (fix|resolve)|how long|resolution|cycle/.test(text)) {
    return {
      title: 'Average days to resolve',
      metric: 'avg_resolution_days',
      groupBy: /type|kind/.test(text) ? 'type' : 'none',
      filters: { status: 'done', ...sprint },
      chart: 'number',
    };
  }
  if (/epic/.test(text)) {
    return {
      title: 'Epic progress',
      metric: 'progress',
      groupBy: 'epic',
      filters: sprint,
      chart: 'table',
    };
  }
  if (/load|busy|each person|who has|workload/.test(text)) {
    return {
      title: 'Open issues by person',
      metric: /point/.test(text) ? 'open_points' : 'open_issues',
      groupBy: 'assignee',
      filters: { status: 'open', ...sprint },
      chart: 'bar',
    };
  }
  return {
    title: 'Issues by status',
    metric: 'issues',
    groupBy: 'status',
    filters: sprint,
    chart: 'bar',
  };
}

const UNITS: Record<string, string> = {
  issues: 'issues',
  points: 'points',
  open_issues: 'issues',
  open_points: 'points',
  avg_resolution_days: 'days',
  progress: 'percent',
};

function measure(metric: string, issues: readonly Row[]) {
  const open = issues.filter((issue) => !isDone(issue));
  switch (metric) {
    case 'points':
      return { value: issues.reduce((sum, i) => sum + points(i), 0), issues: issues.length };
    case 'open_issues':
      return { value: open.length, issues: open.length };
    case 'open_points':
      return { value: open.reduce((sum, i) => sum + points(i), 0), issues: open.length };
    case 'avg_resolution_days': {
      const done = issues.filter(isDone);
      if (!done.length) return { value: 0, issues: 0 };
      const days = done.map((issue) => {
        const end = Date.parse(String(issue['updatedAt'] ?? issue['createdAt']));
        return Math.max(0, end - Date.parse(String(issue['createdAt']))) / DAY;
      });
      return { value: round(days.reduce((a, b) => a + b, 0) / done.length), issues: done.length };
    }
    case 'progress':
      return {
        value: issues.length ? Math.round((issues.filter(isDone).length / issues.length) * 100) : 0,
        issues: issues.length,
      };
    default:
      return { value: issues.length, issues: issues.length };
  }
}

function run(db: MockDb, context: ReportContext, spec: Spec) {
  const active = new Set(
    sprintRows(db)
      .filter((s) => s['state'] === 'active')
      .map((s) => s.id),
  );
  const me = currentUser(db)?.id;
  const issues = context.issues.filter((issue) => {
    const { status, sprint, assignee } = spec.filters;
    if (status === 'open' && isDone(issue)) return false;
    if (status === 'done' && !isDone(issue)) return false;
    if (sprint === 'active' && !active.has(String(issue['sprintId']))) return false;
    if (assignee === 'me' && issue['assigneeId'] !== me) return false;
    if (assignee === 'unassigned' && issue['assigneeId']) return false;
    return true;
  });
  const groups = new Map<string | null, { label: string; issues: Row[] }>();
  if (spec.groupBy !== 'none') {
    for (const issue of issues) {
      for (const bucket of bucketsOf(spec.groupBy, issue, db, context)) {
        const group = groups.get(bucket.id) ?? { label: bucket.label, issues: [] };
        group.issues.push(issue);
        groups.set(bucket.id, group);
      }
    }
  }
  const rows = [...groups]
    .map(([id, group]) => ({ id, label: group.label, ...measure(spec.metric, group.issues) }))
    .filter((row) => row.issues > 0)
    .sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : b.value - a.value));
  return {
    spec,
    unit: UNITS[spec.metric] ?? 'issues',
    rows,
    total: measure(spec.metric, issues).value,
    issues: issues.length,
    generatedAt: new Date(context.now).toISOString(),
  };
}

const pinsByDb = new WeakMap<MockDb, Row[]>();
const pinsOf = (db: MockDb) => {
  const list = pinsByDb.get(db) ?? [];
  pinsByDb.set(db, list);
  return list;
};

const withProject =
  (build: (context: ReportContext, request: MockRequest, db: MockDb) => ReturnType<typeof ok>) =>
  (request: MockRequest, db: MockDb) => {
    const context = reportContext(db, request.params['key']);
    return context ? build(context, request, db) : notFound('Project');
  };

export const workAskReportRoutes: MockRoute[] = [
  {
    method: 'POST',
    pattern: `${W}/projects/:key/reports/ask`,
    handle: withProject((context, request, db) => {
      if (!workspaceAiOn(db) || !aiEnabledFor(db, currentUser(db)?.id ?? null)) {
        return fail(403, 'forbidden', 'AI is turned off', { reason: 'ai_off' });
      }
      const question = String(bodyOf<{ question: string }>(request).question ?? '').trim();
      const result = run(db, context, specFor(question));
      return ok({ question, result, runId: `mock-report-${Date.now()}` });
    }),
  },
  {
    method: 'POST',
    pattern: `${W}/projects/:key/reports/run`,
    handle: withProject((context, request, db) =>
      ok(run(db, context, bodyOf<{ spec: Spec }>(request).spec as Spec)),
    ),
  },
  {
    method: 'GET',
    pattern: `${W}/projects/:key/pinned-reports`,
    handle: withProject((context, _request, db) => {
      const me = currentUser(db)?.id;
      const items = pinsOf(db)
        .filter((pin) => pin['ownerId'] === me && pin['projectId'] === context.project.id)
        .map(({ ownerId: _, ...pin }) => ({
          ...pin,
          result: run(db, context, pin['spec'] as Spec),
          error: null,
        }));
      return ok({ items });
    }),
  },
  {
    method: 'POST',
    pattern: `${W}/projects/:key/pinned-reports`,
    handle: withProject((context, request, db) => {
      const body = bodyOf<{ question: string; spec: Spec }>(request);
      const pin = {
        id: crypto.randomUUID(),
        projectId: context.project.id,
        question: String(body.question ?? ''),
        spec: body.spec,
        createdAt: new Date().toISOString(),
      };
      pinsOf(db).push({ ...pin, ownerId: currentUser(db)?.id });
      return ok(pin, 201);
    }),
  },
  {
    method: 'DELETE',
    pattern: `${W}/pinned-reports/:id`,
    handle: (request, db) => {
      const list = pinsOf(db);
      const at = list.findIndex((pin) => pin.id === request.params['id']);
      if (at === -1) return notFound('That pinned report');
      list.splice(at, 1);
      return ok();
    },
  },
];

import { can, currentUser, type MockDb } from '../db.ts';
import { newId } from '../seed/time.ts';
import {
  seedAutomationRules,
  seedAutomationRuns,
  type AutomationRow,
} from '../seed/work-automation.ts';
import { bodyOf, fail, invalid, notFound, ok, page, type MockRoute } from '../types.ts';
import { AUTOMATION_CATALOG, ruleProblem } from './work-automation-catalog.ts';
import { issueStore } from './work-issue-store.ts';
import { PROJECT_CONFIGURE } from './work-state.ts';

const BASE = '/api/v1/work/automation';
/** Org admins alone hold "Delete workspace"; global rules are theirs. */
const ORG_ADMIN = 'workspace.delete';

interface AutomationState {
  rules: AutomationRow[];
  runs: AutomationRow[];
}

const states = new WeakMap<MockDb, AutomationState>();

export function automationState(db: MockDb): AutomationState {
  let state = states.get(db);
  if (!state) {
    state = { rules: seedAutomationRules(), runs: seedAutomationRuns() };
    states.set(db, state);
  }
  return state;
}

const forbidden = (global: boolean) =>
  fail(
    403,
    'forbidden',
    global
      ? 'Only workspace admins can change global rules.'
      : 'You need "Configure project" to change this project\'s rules.',
  );

const mayChange = (db: MockDb, projectId: string | null) =>
  can(db, projectId === null ? ORG_ADMIN : PROJECT_CONFIGURE);

function owner(db: MockDb) {
  const me = currentUser(db);
  return { ownerId: me?.id ?? null, ownerName: me?.name ?? null };
}

/** Queued and running runs move on each time the log is read, as the worker would. */
function advance(db: MockDb) {
  for (const run of automationState(db).runs) {
    if (run['status'] === 'queued') run['status'] = 'running';
    else if (run['status'] === 'running') {
      const rule = automationState(db).rules.find((row) => row.id === run['ruleId']);
      const actions = (rule?.['actions'] as { name: string }[] | undefined) ?? [];
      Object.assign(run, {
        status: 'succeeded',
        durationMs: 96,
        finishedAt: new Date().toISOString(),
        result: {
          conditionsMet: true,
          actions: actions.map((action) => ({ name: action.name, ok: true, message: 'Done' })),
        },
      });
      if (rule) Object.assign(rule, { lastRunAt: run['finishedAt'], lastRunStatus: 'succeeded' });
    }
  }
}

export const workAutomationRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${BASE}/catalog`,
    handle: () => ok(AUTOMATION_CATALOG),
  },
  {
    method: 'GET',
    pattern: `${BASE}/rules`,
    handle: (request, db) => {
      const projectId = request.query.get('projectId');
      const items = automationState(db).rules.filter(
        (rule) => rule.projectId === null || (projectId !== null && rule.projectId === projectId),
      );
      return ok({ items });
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/rules`,
    handle: (request, db) => {
      const body = bodyOf<AutomationRow>(request);
      const projectId = (body.projectId as string | null | undefined) ?? null;
      if (!mayChange(db, projectId)) return forbidden(projectId === null);
      const problem = ruleProblem(body);
      if (problem) return invalid(problem.path, problem.message);
      const now = new Date().toISOString();
      const rule: AutomationRow = {
        id: newId(),
        projectId,
        name: String(body['name']).trim(),
        enabled: body['enabled'] === true,
        isDraft: false,
        trigger: body['trigger'],
        conditions: body['conditions'] ?? [],
        actions: body['actions'],
        createdBy: currentUser(db)?.id ?? null,
        ...owner(db),
        aiRunId: null,
        lastRunAt: null,
        lastRunStatus: null,
        createdAt: now,
        updatedAt: now,
      };
      automationState(db).rules.push(rule);
      return ok(rule, 201);
    },
  },
  {
    method: 'PATCH',
    pattern: `${BASE}/rules/:id`,
    handle: (request, db) => {
      const rule = automationState(db).rules.find((row) => row.id === request.params['id']);
      if (!rule) return notFound('Rule');
      if (!mayChange(db, rule.projectId)) return forbidden(rule.projectId === null);
      const patch = bodyOf<AutomationRow>(request);
      const problem = ruleProblem({ ...rule, ...patch });
      if (problem) return invalid(problem.path, problem.message);
      const rest = { ...patch };
      delete rest.projectId;
      Object.assign(rule, rest, owner(db), { updatedAt: new Date().toISOString() });
      return ok(rule);
    },
  },
  {
    method: 'DELETE',
    pattern: `${BASE}/rules/:id`,
    handle: (request, db) => {
      const state = automationState(db);
      const rule = state.rules.find((row) => row.id === request.params['id']);
      if (!rule) return notFound('Rule');
      if (!mayChange(db, rule.projectId)) return forbidden(rule.projectId === null);
      state.rules = state.rules.filter((row) => row !== rule);
      return ok();
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/rules/:id/runs`,
    handle: (request, db) => {
      const state = automationState(db);
      const rule = state.rules.find((row) => row.id === request.params['id']);
      if (!rule) return notFound('Rule');
      const issueKey = String(bodyOf<{ issueKey: string }>(request).issueKey ?? '')
        .trim()
        .toUpperCase();
      const issue = issueStore(db).issues.find((row) => row['key'] === issueKey);
      if (!issue) return invalid('issueKey', `There is no issue ${issueKey || 'with that key'}.`);
      const now = new Date().toISOString();
      const run: AutomationRow = {
        id: newId(),
        projectId: (issue['projectId'] as string | undefined) ?? rule.projectId,
        ruleId: rule.id,
        ruleName: rule['name'],
        status: 'queued',
        trigger: 'test',
        issueId: issue.id,
        issueKey,
        depth: 0,
        input: { issueKey },
        result: null,
        error: null,
        durationMs: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
      };
      state.runs.unshift(run);
      return ok(run, 201);
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/runs`,
    handle: (request, db) => {
      advance(db);
      const { query } = request;
      const status = query.get('status');
      const ruleId = query.get('ruleId');
      const projectId = query.get('projectId');
      const rows = automationState(db)
        .runs.filter((run) => !status || run['status'] === status)
        .filter((run) => !ruleId || run['ruleId'] === ruleId)
        .filter((run) => !projectId || run.projectId === projectId)
        .sort((a, b) => String(b['createdAt']).localeCompare(String(a['createdAt'])))
        .map(({ projectId: _project, ...run }) => run);
      return ok(page(rows, request, 25));
    },
  },
];

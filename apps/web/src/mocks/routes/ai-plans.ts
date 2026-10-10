import {
  AI_PLAN_REALTIME_KIND,
  aiPlanCreateBodySchema,
  aiPlanRunBodySchema,
  type AiPlan,
  type AiPlanStep,
} from '@bemmoly/shared';
import { audit, can, currentUser, emit, type MockDb } from '../db.ts';
import { newId } from '../seed/time.ts';
import {
  fail,
  notFound,
  ok,
  type MockRequest,
  type MockResponse,
  type MockRoute,
} from '../types.ts';
import { callWork, draftPlan, issueOf } from './ai-plans-planner.ts';
import { aiEnabledFor, aiOf, budgetStatus, parse } from './ai-state.ts';

/*
 * The plans API on the in-memory backend. Planning is canned (ai-plans-planner.ts); running
 * goes through the mock Work routes on a timer, a step at a time as the server's job does, so
 * the palette sees each land and a closed palette does not stop the run.
 */

interface StoredPlan extends AiPlan {
  ownerId: string;
  undo: Record<number, Record<string, unknown>>;
}

const plans = new WeakMap<MockDb, Map<string, StoredPlan>>();
const PLANS = '/api/v1/ai/plans';

function plansOf(db: MockDb): Map<string, StoredPlan> {
  let found = plans.get(db);
  if (!found) {
    found = new Map();
    plans.set(db, found);
  }
  return found;
}

const refuse = (reason: string, message: string) => fail(403, 'forbidden', message, { reason });

/** The refusals the server's facade gives before reaching a provider. */
function refusal(db: MockDb, changes: boolean): MockResponse | null {
  if (!aiEnabledFor(db, db.signedInAs))
    return refuse('ai_off', 'AI is turned off for this workspace');
  if (budgetStatus(db).pausedRoles.includes('strong')) {
    return refuse('budget_reached', "This month's AI budget is spent; it resets on the 1st");
  }
  if (changes && !aiOf(db).settings.privacy.allowActions) {
    return refuse('actions_off', 'AI actions that change data are turned off');
  }
  return null;
}

/** A Local server whose address says "down" fails like a provider that does not answer. */
function providerDown(db: MockDb): MockResponse | null {
  const ai = aiOf(db);
  const strong = ai.roles.strong;
  const provider = ai.providers.find((entry) => entry.id === strong?.providerId);
  if (!provider?.baseUrl?.includes('down')) return null;
  return fail(502, 'provider_error', `${provider.name} didn't answer`, {
    failure: 'unavailable',
    provider: provider.name,
    providerMessage: 'connect ECONNREFUSED',
    retryAfterSeconds: 30,
  });
}

function owned(db: MockDb, request: MockRequest): StoredPlan | null {
  const plan = plansOf(db).get(request.params['id'] ?? '');
  return plan && plan.ownerId === db.signedInAs ? plan : null;
}

const view = ({ ownerId: _owner, undo: _undo, ...plan }: StoredPlan): AiPlan => plan;
const now = () => new Date().toISOString();

function announce(db: MockDb, plan: StoredPlan) {
  plan.updatedAt = now();
  emit(db, AI_PLAN_REALTIME_KIND, [plan.id]);
}

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

/** Makes one step through the mock Work routes; returns undo data or the error words. */
function runStep(db: MockDb, plan: StoredPlan, step: AiPlanStep) {
  const key = String(step.args['key']);
  const before = issueOf(db, key);
  if (!before) return { error: `${key} was not found` };
  const path = `/api/v1/work/issues/${key}`;
  if (step.tool === 'work_add_comment') {
    const name = currentUser(db)?.name ?? 'you';
    const text = `${String(step.args['text'])} — via Bemmoly for ${name}`;
    const response = callWork(db, 'POST', `${path}/comments`, { body: doc(text) });
    const row = response.body as { id: string; aiRunId: string | null } | undefined;
    if (response.status >= 400 || !row) return { error: 'The comment was not posted' };
    row.aiRunId = plan.runId;
    return { undo: { comment: row.id } };
  }
  const field =
    { work_move_to_sprint: 'sprintId', work_assign_issue: 'assigneeId' }[
      step.tool as 'work_move_to_sprint'
    ] ?? 'statusId';
  const response = callWork(db, 'PATCH', path, { [field]: step.args[field] });
  if (response.status >= 400) return { error: 'Bemmoly could not make this change' };
  return { undo: { [field]: before[field] ?? null } };
}

/** About how long the server takes over a step, so the palette's progress can be seen. */
export const MOCK_STEP_MS = 400;

/** The run job: one step every MOCK_STEP_MS, whether or not anyone is watching. */
function work(db: MockDb, plan: StoredPlan) {
  const tick = () => {
    advance(db, plan);
    if (plan.status === 'running') setTimeout(tick, MOCK_STEP_MS);
  };
  setTimeout(tick, MOCK_STEP_MS);
}

function advance(db: MockDb, plan: StoredPlan) {
  if (plan.status !== 'approved' && plan.status !== 'running') return;
  plan.status = 'running';
  const step = plan.steps.find((each) => each.status === 'pending');
  if (step) {
    const outcome = runStep(db, plan, step);
    if ('error' in outcome) Object.assign(step, { status: 'failed', error: outcome.error });
    else {
      Object.assign(step, { status: 'done', undoable: true });
      plan.undo[step.index] = outcome.undo;
    }
    audit(db, 'ai.plan.step_run', 'ai_plan', plan.id);
  }
  if (!plan.steps.some((each) => each.status === 'pending')) {
    plan.status = plan.steps.some((each) => each.status === 'failed') ? 'failed' : 'done';
    plan.finishedAt = now();
  }
  announce(db, plan);
}

export const aiPlanRoutes: MockRoute[] = [
  {
    method: 'POST',
    pattern: PLANS,
    handle: (request, db) => {
      const refused = refusal(db, false) ?? providerDown(db);
      if (refused) return refused;
      const parsed = parse(aiPlanCreateBodySchema, request);
      if (parsed.refused) return parsed.refused;
      const draft = draftPlan(db, parsed.data.request);
      const stamp = now();
      const plan: StoredPlan = {
        id: newId(),
        ownerId: db.signedInAs ?? '',
        request: parsed.data.request,
        summary: draft.summary,
        status: 'proposed',
        runnable: aiOf(db).settings.privacy.allowActions && can(db, 'ai.actions.run'),
        runId: newId(),
        createdAt: stamp,
        updatedAt: stamp,
        approvedAt: null,
        finishedAt: null,
        steps: draft.steps.map((step, index) => ({
          ...step,
          index,
          status: 'proposed',
          error: null,
          undoable: false,
        })),
        undo: {},
      };
      plansOf(db).set(plan.id, plan);
      return ok(view(plan), 201);
    },
  },
  {
    method: 'GET',
    pattern: `${PLANS}/:id`,
    handle: (request, db) => {
      const plan = owned(db, request);
      if (!plan) return notFound('The plan');
      return ok(view(plan));
    },
  },
  {
    method: 'POST',
    pattern: `${PLANS}/:id/run`,
    handle: (request, db) => {
      const plan = owned(db, request);
      if (!plan) return notFound('The plan');
      const refused = refusal(db, true);
      if (refused) return refused;
      if (!plan.runnable) return refuse('actions_off', 'This plan is a preview and cannot run');
      if (plan.status !== 'proposed') {
        return fail(409, 'conflict', 'This plan has already been run or cancelled');
      }
      const parsed = parse(aiPlanRunBodySchema, request);
      if (parsed.refused) return parsed.refused;
      const kept = parsed.data.steps;
      for (const step of plan.steps) {
        const chosen = step.permission === 'ALLOWED' && (!kept || kept.includes(step.index));
        step.status = chosen ? 'pending' : 'skipped';
      }
      if (!plan.steps.some((step) => step.status === 'pending')) {
        return fail(400, 'validation_failed', 'Choose at least one allowed change');
      }
      Object.assign(plan, { status: 'approved', approvedAt: now() });
      announce(db, plan);
      work(db, plan);
      return ok(view(plan));
    },
  },
  {
    method: 'POST',
    pattern: `${PLANS}/:id/cancel`,
    handle: (request, db) => {
      const plan = owned(db, request);
      if (!plan) return notFound('The plan');
      if (['proposed', 'approved', 'running'].includes(plan.status)) {
        plan.status = 'cancelled';
        plan.finishedAt = now();
        for (const step of plan.steps) if (step.status === 'pending') step.status = 'skipped';
        announce(db, plan);
      }
      return ok(view(plan));
    },
  },
  {
    method: 'POST',
    pattern: `${PLANS}/:id/undo`,
    handle: (request, db) => {
      const plan = owned(db, request);
      if (!plan) return notFound('The plan');
      for (const step of [...plan.steps].reverse()) {
        const undo = plan.undo[step.index];
        if (step.status !== 'done' || !undo) continue;
        const key = String(step.args['key']);
        if (typeof undo['comment'] === 'string') {
          callWork(db, 'DELETE', `/api/v1/work/comments/${undo['comment']}`);
        } else {
          callWork(db, 'PATCH', `/api/v1/work/issues/${key}`, undo);
        }
        Object.assign(step, { status: 'undone', undoable: false });
        audit(db, 'ai.plan.step_undone', 'ai_plan', plan.id);
      }
      announce(db, plan);
      return ok(view(plan));
    },
  },
];

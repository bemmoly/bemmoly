import type { EventBus, RequestContext, Unsubscribe } from '@bemmoly/core';
import { NotFoundError, ProviderError, ValidationError } from '@bemmoly/shared';
import type { AutomationRun, CreateAutomationRunBody } from '../../../../shared/index.ts';
import { actorUserId } from '../issues/deps.ts';
import { WORK_AUTOMATION_RUN_JOB } from '../jobs.ts';
import type { AutomationDeps } from './contract.ts';
import { createAutomationEngine } from './engine.ts';
import { insertRun, ruleById, runById, toRun } from './rows.ts';
import { authorizeRules, createRuleStore } from './rules.ts';
import { createRunner, postActionPayloadSchema, queuedRunPayloadSchema } from './runner.ts';
import { queueDueRuns } from './schedule.ts';
import { queueStayRuns } from './stays.ts';
import { TRIGGER_EVENT_KINDS } from './triggers/index.ts';

export type { AutomationDeps, AutomationServices } from './contract.ts';
export { AUTOMATION_MAX_DEPTH } from './contract.ts';

/**
 * Work's automation rules: the rules and their log, the engine that turns issue events into
 * runs, the runner the `work.automation.run` job calls, and the scheduler's minute.
 */
export function createAutomationService(deps: AutomationDeps) {
  const sql = () => {
    if (!deps.database) throw new ProviderError('The work module needs the database');
    return deps.database;
  };
  const engine = createAutomationEngine(deps, sql);
  const execute = createRunner(deps, sql);

  return {
    ...createRuleStore(deps, sql),

    /** Runs a saved rule now against one issue, even while it is off, to see what it does. */
    async test(
      ctx: RequestContext,
      ruleId: string,
      body: CreateAutomationRunBody,
    ): Promise<AutomationRun> {
      const db = sql();
      const rule = await ruleById(db, ruleId);
      await authorizeRules(ctx, rule.project_id);
      const issue = await deps.services.issues.get(ctx, body.issueKey);
      if (rule.project_id && issue.projectId !== rule.project_id) {
        const message = `${issue.key} is in another project`;
        throw new ValidationError(message, {
          details: { issues: [{ path: 'issueKey', message }] },
        });
      }
      const runId = await insertRun(db, {
        ruleId,
        status: 'queued',
        trigger: 'test',
        issueId: issue.id,
        depth: 0,
        input: { issueKey: issue.key, chain: [], triggeredBy: actorUserId(ctx) },
      });
      await deps.jobs?.send(
        WORK_AUTOMATION_RUN_JOB,
        { runId },
        { idempotencyKey: runId, ...(ctx.requestId ? { requestId: ctx.requestId } : {}) },
      );
      return toRun(await runById(db, runId));
    },

    onEvent: engine.onEvent,

    /** The job: a queued run, or a workflow's fire_automation post-action naming a rule. */
    async handleJob(payload: unknown, requestId?: string): Promise<void> {
      const queued = queuedRunPayloadSchema.safeParse(payload);
      if (queued.success) return execute(queued.data.runId, requestId);
      const parsed = postActionPayloadSchema.parse(payload);
      const rule = await ruleById(sql(), parsed.ruleId).catch((error: unknown) => {
        if (error instanceof NotFoundError) return null;
        throw error;
      });
      if (!rule?.enabled) return;
      const runId = await insertRun(sql(), {
        ruleId: rule.id,
        status: 'queued',
        trigger: 'workflow',
        issueId: parsed.issueId,
        depth: 0,
        input: { chain: [] },
      });
      return execute(runId, requestId);
    },

    /** The scheduler's minute: cron rules that fired, then issues overdue in a status. */
    async tick(now?: Date): Promise<number> {
      const at = now ?? deps.now?.() ?? new Date();
      const scheduled = await queueDueRuns(sql(), engine, at);
      return scheduled + (await queueStayRuns(deps, sql(), engine, at));
    },
  };
}

export type AutomationService = ReturnType<typeof createAutomationService>;

/** The engine hears every issue event a trigger listens to. */
export function subscribeAutomation(events: EventBus, automation: AutomationService): Unsubscribe {
  const subscriptions = TRIGGER_EVENT_KINDS.map((kind) =>
    events.subscribe(kind, (event) => automation.onEvent(event)),
  );
  return () => {
    for (const unsubscribe of subscriptions) unsubscribe();
  };
}

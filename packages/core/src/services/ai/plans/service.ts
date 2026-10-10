import {
  AI_PLAN_REALTIME_KIND,
  ConflictError,
  ForbiddenError,
  ValidationError,
  type AiPlan,
  type AiPlanContext,
  type AiPlanCreateBody,
  type AiPlanRunBody,
} from '@bemmoly/shared';
import type { Logger } from 'pino';
import type { SqlClient } from '../../../clients/postgres.ts';
import type { AiFacade } from '../../../contracts/ai.ts';
import type { AuditRecorder } from '../../../contracts/audit.ts';
import type { Actor } from '../../../contracts/authz.ts';
import type { JobQueue } from '../../../contracts/jobs.ts';
import type { RealtimePublisher } from '../../../contracts/realtime.ts';
import type { RequestContext } from '../../authz/index.ts';
import { aiRefusal } from '../refusals.ts';
import { toolSetFor, type AiToolRegistry } from '../tools/registry.ts';
import { createPlanExecutor } from './execute.ts';
import { checkProposals, validateProposals } from './proposals.ts';
import {
  approvePlan,
  insertPlan,
  loadPlan,
  personName,
  setPlanStatus,
  skipPending,
} from './store.ts';

export const AI_PLAN_RUN_JOB = 'ai.plan.run';
export const PLAN_PROMPT_ID = 'ai.plan';

const WORKSPACE = { kind: 'workspace' } as const;

/** Read tool round trips while planning: enough to search, then open what it found. */
const PLANNING_STEPS = 8;

export interface AiPlansDependencies {
  sql: SqlClient;
  /** Read on every call, so the server can bind the facade after the plans service exists. */
  ai: () => AiFacade;
  tools: AiToolRegistry;
  jobs: Pick<JobQueue, 'enqueue'>;
  realtime: RealtimePublisher;
  audit: AuditRecorder;
  /** A request context for an actor outside a request (the run job acts for the person). */
  contextFor(actor: Actor): RequestContext;
  logger?: Pick<Logger, 'warn' | 'error'>;
  now?: () => Date;
}

/** Plans are made by people; an API token or a job has no palette. */
export function personOf(ctx: RequestContext): string {
  if (ctx.actor.kind !== 'user') throw new ForbiddenError('Only a person can make a plan');
  return ctx.actor.id;
}

function describeContext(context: AiPlanContext | undefined): string {
  if (!context?.path && !context?.recordKey) return 'nowhere in particular';
  const parts = [];
  if (context.recordKey) parts.push(`looking at ${context.recordKey}`);
  if (context.path) parts.push(`on ${context.path}`);
  return parts.join(', ');
}

export function createAiPlansService(deps: AiPlansDependencies) {
  const { sql } = deps;
  const announce = (userId: string, planId: string) =>
    deps.realtime.publish({ kind: AI_PLAN_REALTIME_KIND, ids: [planId], userId });
  const executor = createPlanExecutor({ ...deps, announce });

  /** AI on for this person, and (for a change) actions allowed. */
  async function assertOn(actor: Actor, changes: boolean) {
    const policy = await deps.ai().policy(actor);
    if (!policy.enabled) throw aiRefusal('ai_off');
    if (policy.actorOptedOut) throw aiRefusal('opted_out');
    if (changes && !policy.allowActions) throw aiRefusal('actions_off');
    return policy;
  }

  return {
    /**
     * Draws up a plan: the strong role reads through the read tools as the person asking,
     * proposes write calls, and each proposal is checked as that person. With actions off, or
     * for someone who may not run AI actions, the plan is stored as a preview that never runs.
     */
    async create(ctx: RequestContext, body: AiPlanCreateBody): Promise<AiPlan> {
      const userId = personOf(ctx);
      const policy = await assertOn(ctx.actor, false);
      await ctx.authz.authorize(ctx.actor, 'ai.assist.use', WORKSPACE);
      const mayRun =
        policy.allowActions && (await ctx.authz.can(ctx.actor, 'ai.actions.run', WORKSPACE));
      const facade = deps.ai();
      const tools = await deps.tools.available(ctx);
      const today = (deps.now?.() ?? new Date()).toISOString().slice(0, 10);
      const prompt = await facade.renderPrompt(PLAN_PROMPT_ID, {
        person: await personName(sql, userId),
        today,
        context: describeContext(body.context),
        request: body.request,
      });
      const result = await facade.generate({
        role: prompt.role,
        purpose: 'plan',
        actor: ctx.actor,
        system: prompt.system,
        prompt: prompt.prompt,
        promptRef: prompt.promptRef,
        tools: toolSetFor(tools, ctx),
        maxSteps: PLANNING_STEPS,
        ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
      });
      const offered = new Set(tools.map((tool) => tool.name));
      const { proposals, rejected } = validateProposals(result.toolCalls, deps.tools, offered);
      if (rejected.length) {
        deps.logger?.warn({ planRun: result.runId, rejected }, 'plan calls left out');
      }
      const steps = await checkProposals(ctx, proposals);
      const id = await insertPlan(sql, {
        userId,
        request: body.request,
        summary: result.text.trim() || null,
        runnable: mayRun,
        context: body.context ?? {},
        runId: result.runId,
        steps,
      });
      return (await loadPlan(sql, id, userId)).plan;
    },

    async get(ctx: RequestContext, id: string): Promise<AiPlan> {
      return (await loadPlan(sql, id, personOf(ctx))).plan;
    },

    /**
     * Runs the plan as edited: the allowed steps the person kept (all allowed ones when none
     * are named). Denied steps never run. The work happens in a job, so a long plan survives
     * a refresh; progress is announced to the owner after every step.
     */
    async run(ctx: RequestContext, id: string, body: AiPlanRunBody): Promise<AiPlan> {
      const userId = personOf(ctx);
      const stored = await loadPlan(sql, id, userId);
      await assertOn(ctx.actor, true);
      await ctx.authz.authorize(ctx.actor, 'ai.actions.run', WORKSPACE);
      if (!stored.plan.runnable) throw aiRefusal('actions_off');
      if (stored.plan.status !== 'proposed') {
        throw new ConflictError('This plan has already been run or cancelled');
      }
      const allowed = stored.steps
        .filter((step) => step.permission === 'ALLOWED')
        .map((step) => step.step_index);
      const chosen = body.steps ? allowed.filter((index) => body.steps?.includes(index)) : allowed;
      if (chosen.length === 0) throw new ValidationError('Choose at least one allowed change');
      await sql.begin(async (tx) => {
        if (!(await approvePlan(tx, id, userId, chosen))) {
          throw new ConflictError('This plan has already been run or cancelled');
        }
        await deps.jobs.enqueue(
          AI_PLAN_RUN_JOB,
          { planId: id },
          { key: `ai-plan:${id}`, singleton: true, transaction: tx },
        );
      });
      await announce(userId, id);
      return (await loadPlan(sql, id, userId)).plan;
    },

    /** Stops a plan: nothing more runs; steps already made stay made (Undo puts them back). */
    async cancel(ctx: RequestContext, id: string): Promise<AiPlan> {
      const userId = personOf(ctx);
      await loadPlan(sql, id, userId);
      if (await setPlanStatus(sql, id, 'cancelled', ['proposed', 'approved', 'running'])) {
        await skipPending(sql, id);
        await announce(userId, id);
      }
      return (await loadPlan(sql, id, userId)).plan;
    },

    /** Puts back every made step whose tool can, newest first. */
    async undo(ctx: RequestContext, id: string): Promise<AiPlan> {
      const userId = personOf(ctx);
      await loadPlan(sql, id, userId);
      await assertOn(ctx.actor, true);
      await ctx.authz.authorize(ctx.actor, 'ai.actions.run', WORKSPACE);
      await executor.undo(id, userId);
      return (await loadPlan(sql, id, userId)).plan;
    },

    /** The run job's handler. */
    execute: (planId: string) => executor.execute(planId),
  };
}

export type AiPlansService = ReturnType<typeof createAiPlansService>;

import { ConflictError } from '@bemmoly/shared';
import type { SqlExecutor } from '../../../contracts/sql.ts';
import type { Actor } from '../../../contracts/authz.ts';
import type { AiToolRunContext } from '../tools/types.ts';
import { reasonOf } from './proposals.ts';
import type { AiPlansDependencies } from './service.ts';
import {
  claimStep,
  finishStep,
  loadPlan,
  personName,
  setPlanStatus,
  skipPending,
  type StepRow,
} from './store.ts';

type ExecutorDependencies = AiPlansDependencies & {
  announce(userId: string, planId: string): Promise<void>;
};

const INTERRUPTED =
  'Bemmoly stopped while making this change. Check the record before running it again.';
const GONE = 'This kind of change is no longer available.';
const UNEXPECTED = 'Something went wrong making this change.';
const ACTIONS_OFF = 'AI actions that change data were turned off before this ran.';

async function planStatus(sql: SqlExecutor, id: string): Promise<string | null> {
  const [row] = await sql<{ status: string }[]>`select status from ai_plans where id = ${id}`;
  return row?.status ?? null;
}

/**
 * Runs the steps of an approved plan, one at a time and in order, as the person who approved
 * it (actor kind ai_plan, acting for them) and through the module's own services. A step is
 * claimed by moving it from pending to running, so a re-delivered job skips what ran. Every
 * made step writes an audit row pointing back at the plan.
 */
export function createPlanExecutor(deps: ExecutorDependencies) {
  const { sql } = deps;

  async function runContext(planId: string, userId: string, runId: string | null) {
    const actor: Actor = { kind: 'ai_plan', id: planId, userId };
    const base = deps.contextFor(actor);
    const attribution = `via Bemmoly for ${await personName(sql, userId)}`;
    return (stepIndex: number): AiToolRunContext => ({
      ...base,
      planId,
      stepIndex,
      attribution,
      runId,
    });
  }

  async function runStep(
    step: StepRow,
    ctx: AiToolRunContext,
    userId: string,
  ): Promise<'done' | 'failed'> {
    const tool = deps.tools.get(step.tool);
    if (!tool || tool.kind !== 'write') {
      await finishStep(sql, step.plan_id, step.step_index, { status: 'failed', error: GONE });
      return 'failed';
    }
    try {
      // The person's permissions may have changed since they confirmed; check again.
      await tool.authorize(ctx, step.args);
      const outcome = await tool.run(ctx, step.args);
      await finishStep(sql, step.plan_id, step.step_index, {
        status: 'done',
        undo: tool.undo ? (outcome.undo ?? null) : null,
      });
      await deps.audit.record({
        actor: ctx.actor,
        action: 'ai.plan.step_run',
        target: { kind: 'ai_plan', id: step.plan_id },
        after: { step: step.step_index, tool: step.tool, args: step.args, target: step.preview },
        aiPlanId: step.plan_id,
      });
      return 'done';
    } catch (error) {
      const reason = reasonOf(error);
      if (reason === null) {
        deps.logger?.error(
          { err: error, planId: step.plan_id, step: step.step_index },
          'plan step',
        );
      }
      await finishStep(sql, step.plan_id, step.step_index, {
        status: 'failed',
        error: reason ?? UNEXPECTED,
      });
      return 'failed';
    } finally {
      await deps.announce(userId, step.plan_id);
    }
  }

  return {
    async execute(planId: string): Promise<void> {
      const stored = await loadPlan(sql, planId);
      if (!(await setPlanStatus(sql, planId, 'running', ['approved', 'running']))) return;
      const { userId } = stored;
      const contextOf = await runContext(planId, userId, stored.plan.runId);
      let failed = 0;
      for (const step of stored.steps) {
        if (step.status !== 'pending' && step.status !== 'running') continue;
        if ((await planStatus(sql, planId)) === 'cancelled') {
          await skipPending(sql, planId);
          break;
        }
        const tool = deps.tools.get(step.tool);
        if (step.status === 'running') {
          // An earlier delivery died mid-step: retry only what is safe to run twice.
          if (tool?.kind !== 'write' || !tool.idempotent) {
            await finishStep(sql, planId, step.step_index, {
              status: 'failed',
              error: INTERRUPTED,
            });
            failed += 1;
            continue;
          }
        } else if (!(await claimStep(sql, planId, step.step_index))) {
          continue;
        }
        const policy = await deps.ai().policy({ kind: 'user', id: userId });
        if (!policy.enabled || !policy.allowActions) {
          await finishStep(sql, planId, step.step_index, { status: 'failed', error: ACTIONS_OFF });
          failed += 1;
          continue;
        }
        if ((await runStep(step, contextOf(step.step_index), userId)) === 'failed') failed += 1;
      }
      await setPlanStatus(sql, planId, failed > 0 ? 'failed' : 'done', ['running']);
      await deps.announce(userId, planId);
    },

    async undo(planId: string, userId: string): Promise<void> {
      const stored = await loadPlan(sql, planId, userId);
      if (!['done', 'failed', 'cancelled'].includes(stored.plan.status)) {
        throw new ConflictError('A plan can be undone once it has finished running');
      }
      const contextOf = await runContext(planId, userId, stored.plan.runId);
      const made = stored.steps.filter((step) => step.status === 'done' && step.undo != null);
      for (const step of made.reverse()) {
        const tool = deps.tools.get(step.tool);
        if (tool?.kind !== 'write' || !tool.undo) continue;
        const ctx = contextOf(step.step_index);
        await tool.undo(ctx, step.undo);
        await finishStep(sql, planId, step.step_index, { status: 'undone' });
        await deps.audit.record({
          actor: ctx.actor,
          action: 'ai.plan.step_undone',
          target: { kind: 'ai_plan', id: planId },
          before: { step: step.step_index, tool: step.tool, target: step.preview },
          aiPlanId: planId,
        });
      }
      await deps.announce(userId, planId);
    },
  };
}

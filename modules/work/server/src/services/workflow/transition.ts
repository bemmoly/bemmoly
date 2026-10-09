import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { ForbiddenError, NotFoundError, ValidationError } from '@bemmoly/shared';
import type { AvailableTransition, WorkflowRule } from '../../../../shared/index.ts';
import type { TransitionGate, TransitionResult, WorkflowIssue } from './contract.ts';
import type { WorkflowServiceDeps } from './deps.ts';
import { issueReads, issueWrites, loadActorRoleId } from './issue-access.ts';
import { runChecks, runPostAction, type RuleContext } from './rules/index.ts';
import {
  loadStatuses,
  loadTransitions,
  loadWorkflowForProject,
  type StatusRow,
  type TransitionRow,
} from './rows.ts';
import { requireDatabase } from './workflows.ts';

interface Graph {
  statuses: Map<string, StatusRow>;
  /** Transitions out of the issue's status, the "Any" ones included, in editor order. */
  outgoing: TransitionRow[];
}

async function graphFor(sql: SqlExecutor, issue: WorkflowIssue): Promise<Graph> {
  const workflow = await loadWorkflowForProject(sql, issue.project_id);
  if (!workflow) throw new NotFoundError('The project has no workflow');
  const [statuses, transitions] = await Promise.all([
    loadStatuses(sql, workflow.id),
    loadTransitions(sql, workflow.id),
  ]);
  return {
    statuses: new Map(statuses.map((status) => [status.id, status])),
    outgoing: transitions.filter(
      (transition) =>
        transition.from_status_id === null || transition.from_status_id === issue.status_id,
    ),
  };
}

const userIdOf = (ctx: RequestContext) =>
  ctx.actor.kind === 'user' ? ctx.actor.id : (ctx.actor.userId ?? null);

/** The gate of the tech design: role, then every condition, then every validator. */
export function createTransitionGate(deps: WorkflowServiceDeps): TransitionGate {
  const project = (issue: WorkflowIssue) =>
    ({ kind: 'project', id: issue.project_id, moduleId: 'work' }) as const;

  function ruleContext(
    ctx: RequestContext,
    sql: SqlExecutor,
    issue: WorkflowIssue,
    toStatus: StatusRow,
    submitted: Record<string, unknown>,
  ): RuleContext {
    return {
      ctx,
      sql,
      issue,
      toStatus: { id: toStatus.id, name: toStatus.name, category: toStatus.category },
      submitted,
      reads: issueReads,
      writes: issueWrites,
      ...(deps.lql ? { lql: deps.lql } : {}),
      ...(deps.jobs ? { jobs: deps.jobs } : {}),
    };
  }

  /** Org admins pass every status; others need their project or org role listed, if any are. */
  async function roleAllows(
    ctx: RequestContext,
    sql: SqlExecutor,
    issue: WorkflowIssue,
    status: StatusRow,
  ): Promise<boolean> {
    if (status.allowed_role_ids.length === 0 || ctx.actor.kind === 'system') return true;
    if (await ctx.authz.isOrgAdmin(ctx.actor)) return true;
    const roleId = await loadActorRoleId(sql, userIdOf(ctx), issue.project_id);
    return roleId !== null && status.allowed_role_ids.includes(roleId);
  }

  async function blockers(
    ctx: RequestContext,
    sql: SqlExecutor,
    issue: WorkflowIssue,
    transition: TransitionRow,
    toStatus: StatusRow,
    submitted: Record<string, unknown>,
  ): Promise<{ reasons: string[]; roleDenied: boolean }> {
    if (!(await roleAllows(ctx, sql, issue, toStatus))) {
      return { reasons: [`Your role cannot move issues to ${toStatus.name}`], roleDenied: true };
    }
    const context = ruleContext(ctx, sql, issue, toStatus, submitted);
    const conditions = await runChecks(transition.rules.conditions, 'condition', context);
    return { reasons: conditions.ok ? [] : conditions.reasons, roleDenied: false };
  }

  return {
    async canTransition(ctx, issue): Promise<AvailableTransition[]> {
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', project(issue));
      const sql = requireDatabase(deps);
      const graph = await graphFor(sql, issue);
      const result: AvailableTransition[] = [];
      for (const transition of graph.outgoing) {
        const toStatus = graph.statuses.get(transition.to_status_id);
        if (!toStatus || toStatus.id === issue.status_id) continue;
        const { reasons } = await blockers(ctx, sql, issue, transition, toStatus, {});
        result.push({
          id: transition.id,
          name: transition.name,
          toStatusId: toStatus.id,
          toStatusName: toStatus.name,
          toStatusCategory: toStatus.category,
          available: reasons.length === 0,
          blockedBy: reasons,
        });
      }
      return result;
    },

    async transition(ctx, issue, toStatusId, submitted, sql): Promise<TransitionResult> {
      await ctx.authz.authorize(ctx.actor, 'work.issue.transition', project(issue));
      const executor = sql ?? requireDatabase(deps);
      const graph = await graphFor(executor, issue);
      const toStatus = graph.statuses.get(toStatusId);
      if (!toStatus) throw new NotFoundError('The target status is not in this workflow');
      const transition = graph.outgoing.find((edge) => edge.to_status_id === toStatusId);
      if (!transition) {
        throw new ValidationError(`No transition leads from this status to ${toStatus.name}`, {
          code: 'bad_request',
        });
      }
      const blocked = await blockers(ctx, executor, issue, transition, toStatus, submitted);
      if (blocked.roleDenied) throw new ForbiddenError(blocked.reasons[0]);
      if (blocked.reasons.length > 0) {
        throw new ValidationError('The transition is blocked', {
          details: { transitionId: transition.id, reasons: blocked.reasons },
        });
      }
      const context = ruleContext(ctx, executor, issue, toStatus, submitted);
      const validators = await runChecks(transition.rules.validators, 'validator', context);
      if (!validators.ok) {
        throw new ValidationError('The transition form is not complete', {
          details: { transitionId: transition.id, reasons: validators.reasons },
        });
      }
      return {
        transitionId: transition.id,
        toStatus: context.toStatus,
        postActions: transition.rules.postActions,
      };
    },

    /** Runs after the issues service committed the move; `issue` is the row as it now stands. */
    async runPostActions(ctx, issue, actions: readonly WorkflowRule[]): Promise<void> {
      if (actions.length === 0) return;
      const sql = requireDatabase(deps);
      const [status] = await sql<StatusRow[]>`
        select id, workflow_id, name, category, color, position, allowed_role_ids
        from workflow_statuses where id = ${issue.status_id}`;
      if (!status) throw new NotFoundError('The issue status is not in a workflow');
      const context = ruleContext(ctx, sql, issue, status, {});
      for (const action of actions) await runPostAction(action, context);
    },
  };
}

import { decodeCursor, toPage, type RequestContext, type SqlClient } from '@bemmoly/core';
import { z } from 'zod';
import {
  createAutomationRuleBodySchema,
  updateAutomationRuleBodySchema,
  type AutomationCatalog,
  type AutomationRule,
  type AutomationRunsPage,
  type CreateAutomationRuleBody,
  type ListAutomationRulesQuery,
  type ListAutomationRunsQuery,
  type UpdateAutomationRuleBody,
} from '../../../../shared/index.ts';
import { actorUserId, MODULE_RESOURCE, projectResource } from '../issues/deps.ts';
import { allActions } from './actions/index.ts';
import type { AutomationDeps } from './contract.ts';
import {
  RULE_SELECT,
  RUN_SELECT,
  ruleById,
  toRule,
  toRun,
  type RuleRow,
  type RunRow,
} from './rows.ts';
import { allTriggers } from './triggers/index.ts';
import { assertValidRule } from './validate.ts';

const CONFIGURE = 'work.project.configure';

/** A project's rules are its admins'; global rules run everywhere, so they are org admins'. */
export const authorizeRules = (ctx: RequestContext, projectId: string | null) =>
  ctx.authz.authorize(
    ctx.actor,
    CONFIGURE,
    projectId ? projectResource(projectId) : MODULE_RESOURCE,
  );

const entry = (definition: {
  name: string;
  label: string;
  description: string;
  params: z.ZodType;
}) => ({
  name: definition.name,
  label: definition.label,
  description: definition.description,
  params: z.toJSONSchema(definition.params, { io: 'input', unrepresentable: 'any' }) as Record<
    string,
    unknown
  >,
  available: true,
});

/** Rules: create, read, change and remove, each audited; runs: the log, newest first. */
export function createRuleStore(deps: AutomationDeps, sql: () => SqlClient) {
  async function audited(
    ctx: RequestContext,
    action: string,
    id: string,
    before?: AutomationRule,
    after?: AutomationRule,
  ) {
    await deps.audit?.record({
      actor: ctx.actor,
      action,
      target: { kind: 'automation_rule', id },
      ...(before ? { before } : {}),
      ...(after ? { after } : {}),
      meta: ctx.requestId ? { requestId: ctx.requestId } : {},
    });
  }

  return {
    /** What the rule builder offers; anyone with Work may read it, it holds no data. */
    async catalog(ctx: RequestContext): Promise<AutomationCatalog> {
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', MODULE_RESOURCE);
      return { triggers: allTriggers().map(entry), actions: allActions().map(entry) };
    },

    async list(ctx: RequestContext, query: ListAutomationRulesQuery): Promise<AutomationRule[]> {
      await authorizeRules(ctx, query.projectId ?? null);
      const db = sql();
      const rows = await db<RuleRow[]>`
        ${db.unsafe(RULE_SELECT)}
        where r.project_id is null
          ${query.projectId ? db`or r.project_id = ${query.projectId}` : db``}
        order by r.project_id nulls last, r.created_at, r.id`;
      return rows.map(toRule);
    },

    async get(ctx: RequestContext, id: string): Promise<AutomationRule> {
      const row = await ruleById(sql(), id);
      await authorizeRules(ctx, row.project_id);
      return toRule(row);
    },

    async create(ctx: RequestContext, input: CreateAutomationRuleBody): Promise<AutomationRule> {
      const body = createAutomationRuleBodySchema.parse(input);
      await authorizeRules(ctx, body.projectId ?? null);
      assertValidRule(body);
      const db = sql();
      const userId = actorUserId(ctx);
      const [row] = await db<{ id: string }[]>`
        insert into automation_rules (project_id, name, enabled, trigger, conditions, actions,
          created_by, owner_id)
        values (${body.projectId ?? null}, ${body.name}, ${body.enabled},
          ${JSON.stringify(body.trigger)}::jsonb, ${JSON.stringify(body.conditions)}::jsonb,
          ${JSON.stringify(body.actions)}::jsonb, ${userId}, ${userId})
        returning id`;
      const rule = toRule(await ruleById(db, row!.id));
      await audited(ctx, 'automation_rule.created', rule.id, undefined, rule);
      return rule;
    },

    /** Saving makes the saver the owner: the rule acts with their permissions from now on. */
    async update(
      ctx: RequestContext,
      id: string,
      input: UpdateAutomationRuleBody,
    ): Promise<AutomationRule> {
      const body = updateAutomationRuleBodySchema.parse(input);
      const db = sql();
      const before = await ruleById(db, id);
      await authorizeRules(ctx, before.project_id);
      const next = {
        name: body.name ?? before.name,
        enabled: body.enabled ?? before.enabled,
        trigger: body.trigger ?? before.trigger,
        conditions: body.conditions ?? before.conditions,
        actions: body.actions ?? before.actions,
      };
      assertValidRule(next);
      await db`
        update automation_rules set name = ${next.name}, enabled = ${next.enabled},
          trigger = ${JSON.stringify(next.trigger)}::jsonb,
          conditions = ${JSON.stringify(next.conditions)}::jsonb,
          actions = ${JSON.stringify(next.actions)}::jsonb,
          is_draft = false, owner_id = ${actorUserId(ctx)}, updated_at = now()
        where id = ${id}`;
      const rule = toRule(await ruleById(db, id));
      await audited(ctx, 'automation_rule.updated', id, toRule(before), rule);
      return rule;
    },

    async remove(ctx: RequestContext, id: string): Promise<void> {
      const db = sql();
      const before = await ruleById(db, id);
      await authorizeRules(ctx, before.project_id);
      await db`delete from automation_rules where id = ${id}`;
      await audited(ctx, 'automation_rule.deleted', id, toRule(before));
    },

    /** A project's log holds its own rules' runs and global rules' runs on its issues. */
    async runs(ctx: RequestContext, query: ListAutomationRunsQuery): Promise<AutomationRunsPage> {
      const db = sql();
      const ruleProject = query.ruleId ? (await ruleById(db, query.ruleId)).project_id : null;
      const projectId = query.projectId ?? ruleProject;
      await authorizeRules(ctx, projectId);
      const cursor = decodeCursor(query.cursor);
      const limit = query.limit ?? 50;
      const rows = await db<RunRow[]>`
        ${db.unsafe(RUN_SELECT)}
        where true
          ${query.ruleId ? db`and x.rule_id = ${query.ruleId}` : db``}
          ${query.status ? db`and x.status = ${query.status}` : db``}
          ${projectId ? db`and (r.project_id = ${projectId} or i.project_id = ${projectId})` : db`and r.project_id is null`}
          ${cursor ? db`and x.id < ${cursor}` : db``}
        order by x.id desc
        limit ${limit + 1}`;
      const page = toPage(rows, limit);
      return { items: page.rows.map(toRun), nextCursor: page.nextCursor };
    },
  };
}

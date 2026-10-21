import type { RequestContext, SqlClient } from '@bemmoly/core';
import type { AutomationDeps } from './contract.ts';
import type { AutomationEngine } from './engine.ts';
import { findTrigger, STAY_TRIGGERS } from './triggers/index.ts';

/** One minute looks at this many overdue issues per rule; the rest wait for the next minute. */
export const STAY_ISSUE_LIMIT = 100;

interface StayRuleRow {
  id: string;
  project_id: string | null;
  owner_id: string | null;
  trigger: { name: string; args?: Record<string, unknown> };
  conditions: string[];
}

interface OverdueRow {
  id: string;
  key: string;
  status_id: string;
  status_changed_at: Date | string;
}

/**
 * The scheduler's minute for time-in-status rules: every issue that has sat in the rule's
 * status longer than its duration, and matches its conditions now, gets one run for that stay.
 * The stay is claimed with an insert keyed on (rule, issue, status, entered at), so a repeated
 * or concurrent tick never queues it twice, and a stay whose conditions do not match yet is
 * left unclaimed to be looked at again next minute.
 */
export async function queueStayRuns(
  deps: AutomationDeps,
  sql: SqlClient,
  engine: AutomationEngine,
  now: Date,
): Promise<number> {
  const rules = await sql<StayRuleRow[]>`
    select id, project_id, owner_id, trigger, conditions from automation_rules
    where enabled and not is_draft and trigger ->> 'name' = any(${STAY_TRIGGERS}::text[])
    order by id`;
  let queued = 0;
  for (const rule of rules) {
    const trigger = findTrigger(rule.trigger.name);
    const args = trigger?.params.safeParse(rule.trigger.args ?? {});
    if (!trigger?.stay || !args?.success) continue;
    const { status, ms } = trigger.stay(args.data);
    const cutoff = new Date(now.getTime() - ms).toISOString();
    const overdue = await sql<OverdueRow[]>`
      select i.id, i.key, i.status_id, i.status_changed_at from issues i
      join workflow_statuses s on s.id = i.status_id
      where i.deleted_at is null and i.archived_at is null
        and lower(s.name) = lower(${status})
        and (${rule.project_id}::uuid is null or i.project_id = ${rule.project_id})
        and i.status_changed_at <= ${cutoff}
        and not exists (
          select 1 from automation_stays a
          where a.rule_id = ${rule.id} and a.issue_id = i.id and a.status_id = i.status_id
            and a.entered_at = i.status_changed_at)
      order by i.status_changed_at, i.id
      limit ${STAY_ISSUE_LIMIT}`;
    if (overdue.length === 0) continue;
    const ctx = conditionContext(deps, rule);
    for (const issue of overdue) {
      if (rule.conditions.length > 0) {
        if (!ctx || !(await matchesAll(deps, ctx, issue.id, rule.conditions))) continue;
      }
      const enteredAt = new Date(issue.status_changed_at).toISOString();
      const claimed = await sql`
        insert into automation_stays (rule_id, issue_id, status_id, entered_at)
        values (${rule.id}, ${issue.id}, ${issue.status_id}, ${enteredAt})
        on conflict do nothing
        returning id`;
      if (claimed.length === 0) continue;
      await engine.queue({
        ruleId: rule.id,
        status: 'queued',
        trigger: rule.trigger.name,
        issueId: issue.id,
        depth: 0,
        input: { issueKey: issue.key, status, enteredAt, chain: [], triggeredBy: null },
      });
      queued += 1;
    }
  }
  return queued;
}

/** Conditions are read as the rule's owner would see the issue, as the run itself will. */
function conditionContext(deps: AutomationDeps, rule: StayRuleRow): RequestContext | null {
  if (!rule.owner_id || !deps.contextFor) return null;
  return deps.contextFor({ kind: 'automation', id: rule.id, userId: rule.owner_id, chain: [] }, {});
}

async function matchesAll(
  deps: AutomationDeps,
  ctx: RequestContext,
  issueId: string,
  conditions: readonly string[],
): Promise<boolean> {
  for (const query of conditions) {
    if (!(await deps.lql.matches(ctx, issueId, query))) return false;
  }
  return true;
}

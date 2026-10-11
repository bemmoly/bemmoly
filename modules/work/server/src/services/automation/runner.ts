import type { RequestContext, SqlClient } from '@bemmoly/core';
import { z } from 'zod';
import type { AutomationRunResult, Issue } from '../../../../shared/index.ts';
import { findAction } from './actions/index.ts';
import type { AutomationDeps } from './contract.ts';
import { ruleById, runById, type RuleRow, type RunRow } from './rows.ts';

/** A scheduled run acts on this many issues at most; the run log says when there were more. */
export const SCHEDULE_ISSUE_LIMIT = 100;

type Outcome = AutomationRunResult['actions'][number];

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'The action failed for an unknown reason';

/**
 * Runs one queued run as the rule's own actor: kind automation, acting for the rule's owner,
 * carrying the chain of rules that led here. Every action goes through the same services and
 * authorize() a request would, and leaves an audit row. The first failing action ends the run.
 */
export function createRunner(deps: AutomationDeps, sql: () => SqlClient) {
  async function act(ctx: RequestContext, rule: RuleRow, issue: Issue, triggeredBy: string | null) {
    const outcomes: Outcome[] = [];
    for (const entry of rule.actions) {
      const action = findAction(entry.name);
      const args = action?.params.safeParse(entry.args ?? {});
      if (!action || !args?.success) {
        outcomes.push({ name: entry.name, ok: false, message: 'The action is not valid any more' });
        return outcomes;
      }
      try {
        const message = await action.run(args.data, {
          ctx,
          issue: (await deps.services.issues.get(ctx, issue.key)) as Issue,
          services: deps.services,
          rule: { id: rule.id, name: rule.name },
          triggeredBy,
        });
        outcomes.push({ name: entry.name, ok: true, message, issueKey: issue.key });
      } catch (error) {
        outcomes.push({
          name: entry.name,
          ok: false,
          message: errorText(error),
          issueKey: issue.key,
        });
      }
      await deps.audit?.record({
        actor: ctx.actor,
        action: `automation.${entry.name}`,
        target: { kind: 'issue', id: issue.id },
        after: { ruleId: rule.id, args: entry.args, outcome: outcomes.at(-1) },
        meta: ctx.requestId ? { requestId: ctx.requestId } : {},
      });
      if (!outcomes.at(-1)?.ok) return outcomes;
    }
    return outcomes;
  }

  async function conditionsMet(ctx: RequestContext, rule: RuleRow, issueId: string) {
    for (const query of rule.conditions) {
      if (!(await deps.lql.matches(ctx, issueId, query))) return false;
    }
    return true;
  }

  async function targets(ctx: RequestContext, rule: RuleRow, run: RunRow): Promise<Issue[]> {
    if (run.trigger === 'schedule') {
      const page = await deps.lql.query(ctx, {
        lql: rule.conditions.map((query) => `(${query})`).join(' AND '),
        limit: SCHEDULE_ISSUE_LIMIT,
        ...(rule.project_id ? { projectId: rule.project_id } : {}),
      });
      return page.items;
    }
    if (!run.issue_key) return [];
    const issue = await deps.services.issues.get(ctx, run.issue_key);
    return (await conditionsMet(ctx, rule, issue.id)) ? [issue] : [];
  }

  return async function execute(runId: string, requestId?: string): Promise<void> {
    const db = sql();
    // Claimed once: a second delivery of the same job finds it running and stops.
    const claimed = await db`
      update automation_runs set status = 'running', started_at = now(), updated_at = now()
      where id = ${runId} and status = 'queued'
      returning id`;
    if (claimed.length === 0) return;
    const run = await runById(db, runId);
    const started = performance.now();
    const finish = async (status: string, result: AutomationRunResult | null, error?: string) => {
      await db`
        update automation_runs set status = ${status}, result = ${result ? JSON.stringify(result) : null}::jsonb,
          error = ${error ?? null}, finished_at = now(), updated_at = now(),
          duration_ms = ${Math.round(performance.now() - started)}
        where id = ${runId}`;
    };
    const rule = await ruleById(db, run.rule_id);
    if (!rule.enabled && run.trigger !== 'test')
      return finish('skipped', null, 'The rule was turned off');
    if (!rule.owner_id || !deps.contextFor) {
      return finish('failed', null, 'The rule has nobody to act for; an admin must save it again');
    }
    const input = run.input as { chain?: string[]; triggeredBy?: string | null };
    const ctx = deps.contextFor(
      { kind: 'automation', id: rule.id, userId: rule.owner_id, chain: input.chain ?? [] },
      requestId ? { requestId } : {},
    );
    try {
      const issues = await targets(ctx, rule, run);
      if (issues.length === 0) {
        return finish('skipped', { conditionsMet: false, actions: [] }, undefined);
      }
      const outcomes: Outcome[] = [];
      for (const issue of issues) {
        outcomes.push(...(await act(ctx, rule, issue, input.triggeredBy ?? null)));
        if (outcomes.some((outcome) => !outcome.ok)) break;
      }
      const failed = outcomes.find((outcome) => !outcome.ok);
      const result: AutomationRunResult = {
        conditionsMet: true,
        ...(run.trigger === 'schedule' ? { issueCount: issues.length } : {}),
        actions: outcomes,
      };
      await finish(failed ? 'failed' : 'succeeded', result, failed?.message);
    } catch (error) {
      await finish('failed', null, errorText(error));
    }
  };
}

export const queuedRunPayloadSchema = z.object({ runId: z.uuid() });

/** A workflow's fire_automation post-action: the rule, the issue and the status it entered. */
export const postActionPayloadSchema = z.object({ ruleId: z.uuid(), issueId: z.uuid() }).loose();

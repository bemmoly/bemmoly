import type { Actor, DomainEvent, SqlClient, SqlExecutor } from '@bemmoly/core';
import { WORK_AUTOMATION_RUN_JOB } from '../jobs.ts';
import type { IssueEventPayload } from '../issues/events.ts';
import { AUTOMATION_MAX_DEPTH, type AutomationDeps } from './contract.ts';
import { insertRun, type NewRun } from './rows.ts';
import { findTrigger, triggersFor } from './triggers/index.ts';

interface CandidateRow {
  id: string;
  trigger: { name: string; args?: Record<string, unknown> };
}

/** Why a run deep in a chain was not run; the run log shows it as is. */
export const stoppedMessage = (depth: number): string =>
  `Stopped to prevent a loop: ${depth} ${depth === 1 ? 'rule' : 'rules'} in a row led to this run`;

/** The rules whose actions led to this event, oldest first; empty when a person acted. */
export function chainOf(actor: Actor | undefined): string[] {
  if (actor?.kind !== 'automation') return [];
  return [...(actor.chain ?? []), actor.id];
}

const personOf = (actor: Actor | undefined): string | null =>
  !actor || actor.kind === 'system'
    ? null
    : actor.kind === 'user'
      ? actor.id
      : (actor.userId ?? null);

/**
 * Turns one issue event into queued runs, inside the writer's transaction: the enabled rules
 * of the issue's project and the global ones whose trigger matches. Conditions are checked by
 * the run, after the change commits. Loop protection: a rule never runs on an event its own
 * actions caused, directly or through other rules, and a chain stops at a fixed depth with
 * a skipped run that says so.
 */
export function createAutomationEngine(deps: AutomationDeps, sql: () => SqlClient) {
  const maxDepth = deps.maxDepth ?? AUTOMATION_MAX_DEPTH;

  async function queue(executor: SqlExecutor, run: NewRun, inTransaction: boolean) {
    const runId = await insertRun(executor, run);
    if (run.status !== 'queued') return;
    await deps.jobs?.send(
      WORK_AUTOMATION_RUN_JOB,
      { runId },
      { idempotencyKey: runId, ...(inTransaction ? { transaction: executor } : {}) },
    );
  }

  return {
    queue: (run: NewRun) => queue(sql(), run, false),

    async onEvent(event: DomainEvent): Promise<void> {
      const payload = event.payload as IssueEventPayload | undefined;
      const names = triggersFor(event.kind);
      if (!payload?.issue?.id || names.length === 0) return;
      const { issue } = payload;
      const executor = event.transaction ?? sql();
      const rules = await executor<CandidateRow[]>`
        select id, trigger from automation_rules
        where enabled and not is_draft
          and (project_id is null or project_id = ${issue.projectId})
          and trigger ->> 'name' = any(${names}::text[])
        order by id`;
      const chain = chainOf(event.actor);
      for (const rule of rules) {
        const trigger = findTrigger(rule.trigger.name);
        const args = trigger?.params.safeParse(rule.trigger.args ?? {});
        if (
          !trigger ||
          !args?.success ||
          !trigger.matches(args.data, { kind: event.kind, payload })
        ) {
          continue;
        }
        if (chain.includes(rule.id)) continue;
        const run: NewRun = {
          ruleId: rule.id,
          status: 'queued',
          trigger: event.kind,
          issueId: issue.id,
          depth: chain.length,
          input: {
            event: event.kind,
            issueKey: issue.key,
            summary: payload.summary,
            chain,
            triggeredBy: personOf(event.actor),
            ...(payload.fields ? { fields: payload.fields } : {}),
            ...(payload.toStatus
              ? { fromStatus: payload.fromStatus, toStatus: payload.toStatus }
              : {}),
          },
        };
        if (chain.length >= maxDepth) {
          run.status = 'skipped';
          run.error = stoppedMessage(chain.length);
        }
        await queue(executor, run, event.transaction !== undefined);
      }
    },
  };
}

export type AutomationEngine = ReturnType<typeof createAutomationEngine>;

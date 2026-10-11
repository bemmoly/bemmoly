import type { SqlClient } from '@bemmoly/core';
import type { AutomationEngine } from './engine.ts';
import { findTrigger, lastFireTime, SCHEDULED_TRIGGERS } from './triggers/index.ts';

interface ScheduledRow {
  id: string;
  trigger: { name: string; args?: Record<string, unknown> };
  last_scheduled_at: Date | string | null;
  updated_at: Date | string;
}

/**
 * The scheduler's minute: every enabled scheduled rule whose cron fired since it last ran
 * (or since it was saved) gets one run. Claiming the fire time with a conditional update
 * means two workers ticking at once still queue one run.
 */
export async function queueDueRuns(
  sql: SqlClient,
  engine: AutomationEngine,
  now: Date,
): Promise<number> {
  const rows = await sql<ScheduledRow[]>`
    select id, trigger, last_scheduled_at, updated_at from automation_rules
    where enabled and not is_draft and trigger ->> 'name' = any(${SCHEDULED_TRIGGERS}::text[])
    order by id`;
  let queued = 0;
  for (const row of rows) {
    const trigger = findTrigger(row.trigger.name);
    const args = trigger?.params.safeParse(row.trigger.args ?? {});
    if (!trigger?.cron || !args?.success) continue;
    const fired = lastFireTime(trigger.cron(args.data), now);
    const since = new Date(row.last_scheduled_at ?? row.updated_at);
    if (!fired || fired <= since) continue;
    const claimed = await sql`
      update automation_rules set last_scheduled_at = ${fired.toISOString()}
      where id = ${row.id}
        and (last_scheduled_at is null or last_scheduled_at < ${fired.toISOString()})
      returning id`;
    if (claimed.length === 0) continue;
    await engine.queue({
      ruleId: row.id,
      status: 'queued',
      trigger: 'schedule',
      issueId: null,
      depth: 0,
      input: { scheduledFor: fired.toISOString(), chain: [] },
    });
    queued += 1;
  }
  return queued;
}

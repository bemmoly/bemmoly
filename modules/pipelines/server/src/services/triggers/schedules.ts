import type { SqlExecutor } from '@bemmoly/core';
import { CronExpressionParser } from 'cron-parser';
import type { ScheduleSpec } from '../../../../shared/pipeline-spec.ts';
import { definitionOf, templateLookup } from '../runs/templates.ts';

/*
 * Scheduled pipelines (cron in an IANA time zone). An application's schedules are copied
 * out of its pipeline definition into pipeline_schedules whenever the definition changes, so
 * the minute job reads one index for what is due instead of parsing every definition.
 */

/** The first time after `after` the expression fires, or null when it never does. */
export function nextRunAt(cron: string, timeZone: string, after: Date): Date | null {
  try {
    return CronExpressionParser.parse(cron, { tz: timeZone, currentDate: after }).next().toDate();
  } catch {
    return null;
  }
}

async function schedulesOf(sql: SqlExecutor, pipeline: unknown): Promise<ScheduleSpec[]> {
  const definition = definitionOf(pipeline);
  if (!definition) return [];
  if (!('extends' in definition)) return definition.schedules;
  if (definition.schedules) return definition.schedules;
  return (await templateLookup(sql)(definition.extends))?.schedules ?? [];
}

/** Rewrites an application's schedules from its current definition; idempotent. */
export async function refreshSchedules(
  sql: SqlExecutor,
  applicationId: string,
  now = new Date(),
): Promise<number> {
  const [app] = await sql<{ pipeline: unknown }[]>`
    select pipeline from pipeline_applications where id = ${applicationId}`;
  const schedules = app ? await schedulesOf(sql, app.pipeline) : [];
  await sql`
    delete from pipeline_schedules
    where application_id = ${applicationId} and position >= ${schedules.length}`;
  for (const [position, schedule] of schedules.entries()) {
    const next = nextRunAt(schedule.cron, schedule.timeZone, now);
    await sql`
      insert into pipeline_schedules (application_id, position, cron, time_zone, ref, inputs,
        next_run_at)
      values (${applicationId}, ${position}, ${schedule.cron}, ${schedule.timeZone},
        ${schedule.ref ?? null}, ${JSON.stringify(schedule.inputs)}::jsonb,
        ${next?.toISOString() ?? null}::timestamptz)
      on conflict (application_id, position) do update set cron = excluded.cron,
        time_zone = excluded.time_zone, ref = excluded.ref, inputs = excluded.inputs,
        next_run_at = case
          when pipeline_schedules.cron = excluded.cron
            and pipeline_schedules.time_zone = excluded.time_zone
          then pipeline_schedules.next_run_at else excluded.next_run_at end,
        updated_at = now()`;
  }
  return schedules.length;
}

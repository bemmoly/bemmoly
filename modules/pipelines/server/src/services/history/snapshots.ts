import type { SqlExecutor } from '@bemmoly/core';

/*
 * Hourly snapshots of pipeline_current (architecture §18), so rewinding to any moment reads
 * one snapshot and the events after it. Snapshots older than the rewind horizon are dropped.
 */

export async function takeSnapshot(sql: SqlExecutor, now: Date, keepDays: number): Promise<number> {
  const at = now.toISOString();
  const taken = await sql`
    insert into pipeline_current_snapshots
      (taken_at, application_id, environment_id, release_id, version, state, moving_release_id,
       moving_version, traffic_percent, deployment_id, deployed_at)
    select ${at}::timestamptz, application_id, environment_id, release_id, version, state,
      moving_release_id, moving_version, traffic_percent, deployment_id, deployed_at
    from pipeline_current`;
  await sql`
    delete from pipeline_current_snapshots
    where taken_at < ${at}::timestamptz - make_interval(days => ${keepDays})`;
  return taken.count;
}

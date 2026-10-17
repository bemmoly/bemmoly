import type { SqlExecutor } from '@bemmoly/core';
import type { TimelineRecord } from '../../models/delivery.ts';
import { applicationFilter, type MapFilter } from './query.ts';

/**
 * Deploys per 15 minutes over the last 24 hours, oldest first, with a bucket marked as an
 * incident when a Prod deploy in it failed or was rolled back. Always ends now, so the
 * scrubber's range does not move while the person rewinds within it.
 */
export function timeline(sql: SqlExecutor, filter: MapFilter): Promise<TimelineRecord[]> {
  return sql<TimelineRecord[]>`
    with buckets as (
      select generate_series(
        date_bin('15 minutes', now() - interval '23 hours 45 minutes', timestamptz 'epoch'),
        date_bin('15 minutes', now(), timestamptz 'epoch'),
        interval '15 minutes') as start),
    deploys as (
      select date_bin('15 minutes', d.created_at, timestamptz 'epoch') as start,
        count(*)::int as deploys,
        bool_or(e.class = 'prod' and (d.kind = 'rollback' or d.state in ('failed', 'rolled_back')))
          as incident
      from pipeline_deployments d
      join pipeline_applications a on a.id = d.application_id
      join pipeline_environments e on e.id = d.environment_id
      where d.created_at > now() - interval '1 day' ${applicationFilter(sql, filter)}
      group by 1)
    select b.start, coalesce(d.deploys, 0) as deploys, coalesce(d.incident, false) as incident
    from buckets b left join deploys d on d.start = b.start
    order by b.start`;
}

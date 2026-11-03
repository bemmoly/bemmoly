import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { ServiceVersionsResponse } from '../../../../shared/service-views.ts';
import type { VersionRecord } from '../../models/service-views.ts';
import { iso } from '../../utils/time.ts';
import { changeCounts, changeRef, pathEnvironments, toEnvironment } from './path.ts';

/** The newest versions a service's Versions tab lists; older ones stay in its runs. */
const LIMIT = 50;

/**
 * A service's versions, newest first: what built each, its tests, the environments it runs
 * in now and the latest change request that carried it. A version is a release: every build
 * that passed its tests, moved between environments unchanged.
 */
export async function listVersions(
  sql: SqlExecutor,
  key: string,
): Promise<ServiceVersionsResponse> {
  const [application] = await sql<{ id: string }[]>`
    select id from pipeline_applications where key = ${key} and archived_at is null`;
  if (!application) throw new NotFoundError(`No service called "${key}"`);
  const [environments, rows] = await Promise.all([
    pathEnvironments(sql),
    sql<VersionRecord[]>`
      select rel.id, rel.version, rel.commit_sha, run.title as message, rel.created_at,
        u.name as created_by, rel.test_summary, run.id as run_id, run.number as run_number,
        (select array_agg(e.key order by e.position) from pipeline_current c
          join pipeline_environments e on e.id = c.environment_id and e.archived_at is null
          where c.application_id = rel.application_id and c.release_id = rel.id) as running_in,
        chg.number as change_number, chg.status as change_status,
        chg.change_approvals, chg.change_needed
      from pipeline_releases rel
      left join pipeline_runs run on run.id = rel.run_id
      left join users u on u.id = coalesce(rel.created_by, run.author_user_id)
      left join lateral (
        select cr.number, cr.status, ${changeCounts(sql)}
        from pipeline_change_request_items i
        join pipeline_change_requests cr on cr.id = i.change_request_id
        where i.release_id = rel.id and cr.status <> 'withdrawn'
        order by cr.created_at desc limit 1) chg on true
      where rel.application_id = ${application.id}::uuid
      order by rel.created_at desc, rel.id desc
      limit ${LIMIT}`,
  ]);
  return {
    environments: environments.map(toEnvironment),
    items: rows.map((row) => ({
      releaseId: row.id,
      version: row.version,
      commitSha: row.commit_sha,
      message: row.message,
      createdAt: iso(row.created_at),
      createdBy: row.created_by,
      tests:
        row.test_summary && typeof row.test_summary.passed === 'number'
          ? { passed: row.test_summary.passed, failed: row.test_summary.failed ?? 0 }
          : null,
      run:
        row.run_id && row.run_number !== null
          ? { id: row.run_id, number: Number(row.run_number) }
          : null,
      runningIn: row.running_in ?? [],
      change: changeRef(row),
    })),
  };
}

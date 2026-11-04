import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { RunNext, RunNextState } from '../../../../shared/run-next.ts';

/*
 * Where the version a run made goes next, environment by environment along the path: running
 * there, being deployed by this run, or reached by promoting it (through a change request
 * where the environment has an approval rule). Read only; the run screen draws it.
 */

const LIVE_DEPLOYS = new Set(['pending', 'deploying', 'canary', 'waiting']);
const FAILED_DEPLOYS = new Set(['failed', 'rolled_back', 'cancelled']);

export async function whereNext(sql: SqlExecutor, runId: string): Promise<RunNext> {
  const [run] = await sql<
    { id: string; version: string | null; application_id: string | null; key: string | null }[]
  >`
    select r.id, r.version, r.application_id, a.key
    from pipeline_runs r left join pipeline_applications a on a.id = r.application_id
    where r.id = ${runId}`;
  if (!run) throw new NotFoundError('That run does not exist');
  const [release] = run.application_id
    ? await sql<{ id: string; version: string; image_repository: string | null }[]>`
        select id, version, image_repository from pipeline_releases
        where run_id = ${runId} and application_id = ${run.application_id}
        order by created_at desc limit 1`
    : [];
  const rows = await sql<
    {
      key: string;
      name: string;
      approval_rule: boolean;
      deploy_state: string | null;
      revision: string | null;
      job_state: string | null;
      change_number: number | null;
      change_status: string | null;
    }[]
  >`
    select e.key, e.name, e.approval_rule is not null as approval_rule,
      d.state as deploy_state, d.revision, j.state as job_state,
      cr.number::int as change_number, cr.status as change_status
    from pipeline_environments e
    left join lateral (
      select state, revision from pipeline_deployments
      where release_id = ${release?.id ?? null}::uuid and environment_id = e.id
      order by created_at desc limit 1) d on true
    left join lateral (
      select state from pipeline_jobs
      where run_id = ${runId} and kind = 'deploy' and environment_key = e.key
      order by created_at desc limit 1) j on true
    left join lateral (
      select c.number, c.status from pipeline_change_requests c
      join pipeline_change_request_items i on i.change_request_id = c.id
      where i.release_id = ${release?.id ?? null}::uuid and c.environment_id = e.id
      order by c.created_at desc limit 1) cr on true
    where e.archived_at is null
    order by e.position, e.id`;
  return {
    application: run.key,
    version: release?.version ?? run.version,
    releaseId: release?.id ?? null,
    image: release?.image_repository ? `${release.image_repository}:${release.version}` : null,
    environments: rows.map((row) => {
      let state: RunNextState = row.approval_rule ? 'change_request' : 'promote';
      if (row.deploy_state === 'succeeded') state = 'deployed';
      else if (row.deploy_state && LIVE_DEPLOYS.has(row.deploy_state)) state = 'deploying';
      else if (row.deploy_state && FAILED_DEPLOYS.has(row.deploy_state)) state = 'failed';
      else if (row.job_state && ['pending', 'ready', 'running'].includes(row.job_state)) {
        state = 'this_run';
      }
      return {
        key: row.key,
        name: row.name,
        state,
        revision: row.revision,
        changeRequest:
          row.change_number !== null
            ? { number: row.change_number, status: row.change_status ?? 'draft' }
            : null,
      };
    }),
  };
}

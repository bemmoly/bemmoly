import type { SqlExecutor } from '@bemmoly/core';
import type {
  ChangeRequestOptions,
  ChangeRequestOptionsQuery,
} from '../../../../shared/change-request-options.ts';
import { passedIn } from './items.ts';
import { groupMembers, loadEnvironment, previousEnvironment } from './rows.ts';
import { routeOf } from './route.ts';

/*
 * What the New change request form and the Deploy or promote dialog offer for a target: the
 * rule's steps at the chosen risk with who may be picked (the group's members, never the
 * person asking), and each service's recent versions with where they run and whether they
 * may go here.
 */

const RECENT = 15;

interface VersionRow {
  application_key: string;
  application_name: string;
  release_id: string;
  version: string;
  commit_sha: string;
  summary: string | null;
  created_at: string;
  running_in: string[] | null;
  current_release_id: string | null;
  current_version: string | null;
}

export async function changeRequestOptions(
  sql: SqlExecutor,
  query: ChangeRequestOptionsQuery,
  viewer: string,
  canEmergencyDeploy: boolean,
): Promise<ChangeRequestOptions> {
  const environment = await loadEnvironment(sql, { key: query.environment });
  const previous = await previousEnvironment(sql, environment);
  const route = await routeOf(sql, environment, query.risk);
  const steps = await Promise.all(
    route.map(async (step) => ({
      position: step.position,
      group: { id: step.groupId, name: step.groupName },
      count: step.count,
      when: step.when,
      applies: step.applies,
      candidates: (await groupMembers(sql, step.groupId))
        .filter((member) => member.id !== viewer)
        .map((member) => ({ ...member, avatarUrl: null })),
    })),
  );
  const rows = await sql<VersionRow[]>`
    select a.key as application_key, a.name as application_name, r.id as release_id,
      r.version, r.commit_sha, coalesce(r.notes, run.title) as summary, r.created_at,
      (select array_agg(e.key order by e.position) from pipeline_current c2
        join pipeline_environments e on e.id = c2.environment_id
        where c2.release_id = r.id and e.archived_at is null) as running_in,
      cur.release_id as current_release_id, cur_r.version as current_version
    from pipeline_applications a
    cross join lateral (
      select * from pipeline_releases r0 where r0.application_id = a.id
      order by r0.created_at desc, r0.id desc limit ${RECENT}
    ) r
    left join pipeline_runs run on run.id = r.run_id
    left join pipeline_current cur on cur.application_id = a.id
      and cur.environment_id = ${environment.id}
    left join pipeline_releases cur_r on cur_r.id = cur.release_id
    where a.archived_at is null
      ${query.application ? sql`and a.key = ${query.application}` : sql``}
    order by a.key, r.created_at desc, r.id desc`;
  const gated = environment.versions_allowed === 'passed_previous' && previous !== null;
  const passed = gated
    ? await passedIn(
        sql,
        previous.id,
        rows.map((row) => row.release_id),
      )
    : null;
  const services = new Map<string, ChangeRequestOptions['services'][number]>();
  for (const row of rows) {
    const service = services.get(row.application_key) ?? {
      key: row.application_key,
      name: row.application_name,
      current:
        row.current_release_id && row.current_version
          ? { releaseId: row.current_release_id, version: row.current_version }
          : null,
      versions: [],
    };
    service.versions.push({
      releaseId: row.release_id,
      version: row.version,
      commitSha: row.commit_sha,
      summary: row.summary,
      createdAt: new Date(row.created_at).toISOString(),
      runningIn: row.running_in ?? [],
      allowed: row.release_id !== row.current_release_id && (!passed || passed.has(row.release_id)),
    });
    services.set(row.application_key, service);
  }
  return {
    environment: { key: environment.key, name: environment.name },
    needsChangeRequest: environment.approval_rule !== null,
    previousEnvironment: previous ? { key: previous.key, name: previous.name } : null,
    versionsAllowed: environment.versions_allowed,
    window: environment.deploy_window as ChangeRequestOptions['window'],
    steps,
    services: [...services.values()],
    canEmergencyDeploy: canEmergencyDeploy && environment.approval_rule !== null,
  };
}

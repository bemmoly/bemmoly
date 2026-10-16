import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { LiveCounter, Overview, OverviewQuery } from '../../../../shared/overview.ts';
import {
  authorizePipelines,
  requireDatabase,
  requirePerson,
  type PipelinesServiceDeps,
} from '../deps.ts';

interface ScopeRow {
  domain_id: string;
  domain_key: string;
  domain_name: string;
  group_id: string | null;
  group_key: string | null;
  group_name: string | null;
}

interface Scope {
  domain: { id: string; key: string; name: string } | null;
  group: { id: string; key: string; name: string } | null;
}

/** "commerce" or "commerce/checkout" into the domain and group it names. */
export async function resolveScope(sql: SqlExecutor, path: string | undefined): Promise<Scope> {
  if (!path) return { domain: null, group: null };
  const [domainKey, groupKey] = path.split('/');
  const [row] = await sql<ScopeRow[]>`
    select d.id as domain_id, d.key as domain_key, d.name as domain_name,
      g.id as group_id, g.key as group_key, g.name as group_name
    from pipeline_domains d
    left join pipeline_groups g on g.domain_id = d.id and g.key = ${groupKey ?? null}
    where d.key = ${domainKey ?? ''}`;
  if (!row || (groupKey && !row.group_id)) throw new NotFoundError(`No scope called "${path}"`);
  return {
    domain: { id: row.domain_id, key: row.domain_key, name: row.domain_name },
    group:
      row.group_id && row.group_key && row.group_name
        ? { id: row.group_id, key: row.group_key, name: row.group_name }
        : null,
  };
}

/** Applications in the scope, as a condition on an application id column. */
function inScope(sql: SqlExecutor, scope: Scope, column: string) {
  if (scope.group) {
    return sql`${sql.unsafe(column)} in (
      select id from pipeline_applications where group_id = ${scope.group.id}::uuid)`;
  }
  if (scope.domain) {
    return sql`${sql.unsafe(column)} in (
      select id from pipeline_applications where domain_id = ${scope.domain.id}::uuid)`;
  }
  return sql`true`;
}

/** Jobs on runners and jobs ready for one; the top bar's "214 running · 38 queued". */
export async function liveCounter(sql: SqlExecutor, scope: Scope): Promise<LiveCounter> {
  const [row] = await sql<LiveCounter[]>`
    select
      count(*) filter (where state in ('claimed', 'running'))::int as running,
      count(*) filter (where state = 'ready')::int as queued
    from pipeline_jobs
    where state in ('ready', 'claimed', 'running')
      and ${inScope(sql, scope, 'application_id')}`;
  return row ?? { running: 0, queued: 0 };
}

interface TodayRow {
  runs: number;
  prod_deploys: number;
  lead_time: number | null;
  deploys_30d: number;
  failed_30d: number;
  applications: number;
  domains: number;
  teams: number;
  me_name: string | null;
}

/**
 * The organisation's name is the workspace's. A module may read only its own settings through
 * the registry, so this reads the kernel's stored value, with the kernel's default.
 */
async function workspaceName(sql: SqlExecutor): Promise<string> {
  const [row] = await sql<{ name: string | null }[]>`
    select value #>> '{}' as name from settings
    where key = 'workspace.name' and not is_secret limit 1`;
  return row?.name || 'Bemmoly';
}

/** For you's header and the live counter for a scope, in one request. */
export function createOverviewService(deps: PipelinesServiceDeps) {
  return {
    async get(ctx: RequestContext, query: OverviewQuery): Promise<Overview> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const me = requirePerson(ctx.actor);
      const scope = await resolveScope(sql, query.scope);
      const runsInScope = scope.domain
        ? sql`and id in (select run_id from pipeline_run_applications
            where ${inScope(sql, scope, 'application_id')})`
        : sql``;
      const [[today], live, organisation] = await Promise.all([
        sql<TodayRow[]>`
          select
            (select count(*) from pipeline_runs
              where created_at >= date_trunc('day', now()) ${runsInScope})::int as runs,
            (select count(*) from pipeline_deployments dp
              join pipeline_environments e on e.id = dp.environment_id
              where e.class = 'prod' and dp.kind = 'deploy'
                and dp.created_at >= date_trunc('day', now())
                and ${inScope(sql, scope, 'dp.application_id')})::int as prod_deploys,
            (select percentile_cont(0.5) within group (order by lead_time_p50_seconds)
              from pipeline_daily_rollups
              where day > current_date - 30 and lead_time_p50_seconds is not null
                and ${inScope(sql, scope, 'application_id')})::int as lead_time,
            (select coalesce(sum(prod_deploys), 0) from pipeline_daily_rollups
              where day > current_date - 30
                and ${inScope(sql, scope, 'application_id')})::int as deploys_30d,
            (select coalesce(sum(failed_deploys + rollbacks), 0) from pipeline_daily_rollups
              where day > current_date - 30
                and ${inScope(sql, scope, 'application_id')})::int as failed_30d,
            (select count(*) from pipeline_applications
              where archived_at is null and ${inScope(sql, scope, 'id')})::int as applications,
            (select count(*) from pipeline_domains)::int as domains,
            (select count(distinct owner_team_id) from pipeline_applications
              where archived_at is null and ${inScope(sql, scope, 'id')})::int as teams,
            (select name from users where id = ${me}::uuid) as me_name`,
        liveCounter(sql, scope),
        workspaceName(sql),
      ]);
      const name = today?.me_name ?? '';
      return {
        scope: { organisation, domain: scope.domain, group: scope.group },
        today: {
          runs: today?.runs ?? 0,
          prodDeploys: today?.prod_deploys ?? 0,
          changeFailureRate:
            today && today.deploys_30d > 0
              ? Math.min(1, today.failed_30d / today.deploys_30d)
              : null,
          leadTimeSeconds: today?.lead_time ?? null,
        },
        live,
        catalog: {
          applications: today?.applications ?? 0,
          domains: today?.domains ?? 0,
          teams: today?.teams ?? 0,
        },
        me: { id: me, name, firstName: name.split(/\s+/)[0] ?? name },
      };
    },
  };
}

export type OverviewService = ReturnType<typeof createOverviewService>;

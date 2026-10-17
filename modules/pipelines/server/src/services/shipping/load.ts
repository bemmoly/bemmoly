import { createHash } from 'node:crypto';
import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type {
  ReleaseRow,
  ShippingApplicationRow,
  ShippingEnvironmentRow,
} from '../../models/shipping.ts';

/* The reads every shipping service starts from, one query each. */

export const RELEASE_COLUMNS = `r.id, r.application_id, r.version, r.source, r.run_id,
  run.number::int as run_number, run.state as run_state, run.author_user_id as run_author_id,
  r.commit_sha, r.ref, r.image_repository, r.image_digests, r.resolved_config, r.test_summary,
  r.provenance, r.sbom_object_key, r.notes, r.created_by, cu.name as created_by_name,
  r.created_at`;

export async function loadRelease(sql: SqlExecutor, id: string): Promise<ReleaseRow> {
  const [row] = await sql<ReleaseRow[]>`
    select ${sql.unsafe(RELEASE_COLUMNS)}
    from pipeline_releases r
    left join pipeline_runs run on run.id = r.run_id
    left join users cu on cu.id = r.created_by
    where r.id = ${id}`;
  if (!row) throw new NotFoundError('That release does not exist');
  return row;
}

export async function loadApplication(
  sql: SqlExecutor,
  by: { id: string } | { key: string },
): Promise<ShippingApplicationRow> {
  const id = 'id' in by ? by.id : null;
  const key = 'key' in by ? by.key : null;
  const [row] = await sql<ShippingApplicationRow[]>`
    select a.id, a.key, a.name, a.tier, a.runtime, a.domain_id, d.key as domain_key, a.group_id,
      g.key as group_key, a.owner_team_id, a.health
    from pipeline_applications a
    join pipeline_domains d on d.id = a.domain_id
    join pipeline_groups g on g.id = a.group_id
    where (${id}::uuid is not null and a.id = ${id}::uuid) or (${key}::text is not null and a.key = ${key}::text)`;
  if (!row) throw new NotFoundError('That application does not exist');
  return row;
}

export async function loadEnvironments(sql: SqlExecutor): Promise<ShippingEnvironmentRow[]> {
  return sql<ShippingEnvironmentRow[]>`
    select id, key, name, class, provider, region, position, protection, cloud_account_id
    from pipeline_environments where archived_at is null order by position, id`;
}

export async function loadEnvironment(
  sql: SqlExecutor,
  id: string,
): Promise<ShippingEnvironmentRow> {
  const [row] = await sql<ShippingEnvironmentRow[]>`
    select id, key, name, class, provider, region, position, protection, cloud_account_id
    from pipeline_environments where id = ${id}`;
  if (!row) throw new NotFoundError('That environment does not exist');
  return row;
}

/**
 * What an approval binds to: the images by digest and the resolved configuration. Two
 * releases with the same code but different config are different things to approve.
 */
export function releaseDigest(release: ReleaseRow): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
      );
    }
    return value;
  };
  const body = JSON.stringify(
    canonical({
      application: release.application_id,
      version: release.version,
      commit: release.commit_sha,
      images: release.image_digests,
      config: release.resolved_config,
    }),
  );
  return `sha256:${createHash('sha256').update(body).digest('hex')}`;
}

/** People who wrote or asked for the change: never approvers when a rule excludes authors. */
export function authorsOf(release: ReleaseRow, requestedBy: string | null): string[] {
  return [
    ...new Set(
      [release.created_by, release.run_author_id, requestedBy].filter(
        (id): id is string => typeof id === 'string',
      ),
    ),
  ];
}

/** Moving a release on (or stopping it) in Prod is request_prod; elsewhere it is deploy. */
export async function deployActionFor(
  sql: SqlExecutor,
  environmentId: string,
): Promise<'deploy' | 'request_prod'> {
  const [row] = await sql<{ class: string }[]>`
    select class from pipeline_environments where id = ${environmentId}`;
  return row?.class === 'prod' ? 'request_prod' : 'deploy';
}

import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import { topicOf } from '../../../../shared/streams.ts';
import type { WritableApplicationRow } from '../../models/catalog-writes.ts';
import { publishStreamEvent } from '../streams/index.ts';

/* Finding what a write names, and telling open screens it changed. */

export async function domainByKey(sql: SqlExecutor, key: string) {
  const [domain] = await sql<{ id: string; key: string; name: string }[]>`
    select id, key, name from pipeline_domains where key = ${key}`;
  if (!domain) throw new NotFoundError(`No domain called "${key}"`);
  return domain;
}

/** "commerce/checkout" → the group and its domain. */
export async function groupByPath(sql: SqlExecutor, path: string) {
  const [domainKey = '', groupKey = ''] = path.split('/');
  const [group] = await sql<
    { id: string; key: string; name: string; domain_id: string; domain_key: string }[]
  >`
    select g.id, g.key, g.name, d.id as domain_id, d.key as domain_key
    from pipeline_groups g join pipeline_domains d on d.id = g.domain_id
    where d.key = ${domainKey} and g.key = ${groupKey}`;
  if (!group) {
    throw new ValidationError(`No group "${groupKey}" in a domain called "${domainKey}"`, {
      details: { fields: { group: 'Not a group' } },
    });
  }
  return group;
}

export const APPLICATION_SELECT = `
  a.id, a.key, a.name, a.description, a.domain_id, d.key as domain_key, a.group_id,
  g.key as group_key, a.owner_team_id, t.name as owner_team_name, a.tier, a.labels,
  a.lifecycle, a.runtime, a.ci_mode, a.promotion_mode, a.path, a.paths, a.source, a.file_path,
  a.repository_id, r.full_name as repository_full_name,
  r.default_branch as repository_default_branch, a.archived_at,
  coalesce((select array_agg(x.key order by x.key) from pipeline_application_dependencies dep
    join pipeline_applications x on x.id = dep.depends_on_id
    where dep.application_id = a.id and dep.source = 'declared'), '{}') as depends_on`;

export const APPLICATION_JOINS = `
  pipeline_applications a
  join pipeline_domains d on d.id = a.domain_id
  join pipeline_groups g on g.id = a.group_id
  left join teams t on t.id = a.owner_team_id
  left join pipeline_repositories r on r.id = a.repository_id`;

export async function applicationByKey(
  sql: SqlExecutor,
  key: string,
): Promise<WritableApplicationRow> {
  const [row] = await sql<WritableApplicationRow[]>`
    select ${sql.unsafe(APPLICATION_SELECT)} from ${sql.unsafe(APPLICATION_JOINS)}
    where a.key = ${key}`;
  if (!row) throw new NotFoundError(`No application called "${key}"`);
  return row;
}

/** The ids of `keys`, refusing any that do not exist and an application depending on itself. */
export async function dependencyIds(sql: SqlExecutor, self: string, keys: readonly string[]) {
  const unique = [...new Set(keys)];
  if (unique.includes(self)) {
    throw new ValidationError('An application cannot depend on itself', {
      details: { fields: { dependsOn: 'Includes itself' } },
    });
  }
  if (unique.length === 0) return [];
  const rows = await sql<{ id: string; key: string }[]>`
    select id, key from pipeline_applications where key = any(${unique}::text[])`;
  const missing = unique.filter((key) => !rows.some((row) => row.key === key));
  if (missing.length > 0) {
    throw new ValidationError(`No application called ${missing.map((k) => `"${k}"`).join(', ')}`, {
      details: { fields: { dependsOn: 'Unknown application' } },
    });
  }
  return rows.map((row) => row.id);
}

/** Replaces an application's declared dependencies; learned ones are left alone. */
export async function writeDependencies(
  sql: SqlExecutor,
  applicationId: string,
  ids: readonly string[],
) {
  await sql`
    delete from pipeline_application_dependencies
    where application_id = ${applicationId}::uuid and source = 'declared'
      and not (depends_on_id = any(${ids}::uuid[]))`;
  if (ids.length === 0) return;
  await sql`
    insert into pipeline_application_dependencies (application_id, depends_on_id, source)
    select ${applicationId}::uuid, unnest(${ids}::uuid[]), 'declared'
    on conflict (application_id, depends_on_id)
      do update set source = 'declared', updated_at = now()`;
}

/** Inside the writing transaction: screens showing these applications or the map refetch. */
export async function publishCatalog(
  sql: SqlExecutor,
  applications: readonly string[],
  domainKey?: string,
): Promise<void> {
  const data = { applications: applications.slice(0, 100) };
  for (const key of applications.slice(0, 20)) {
    await publishStreamEvent(sql, {
      topic: topicOf.application(key),
      kind: 'catalog.updated',
      data,
    });
  }
  if (domainKey) {
    await publishStreamEvent(sql, { topic: topicOf.map(domainKey), kind: 'catalog.updated', data });
  }
  await publishStreamEvent(sql, { topic: topicOf.map(), kind: 'catalog.updated', data });
}

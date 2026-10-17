import type { SqlExecutor } from '@bemmoly/core';
import type { ApplicationFilters, ApplicationSort } from '../../../../shared/catalog.ts';
import { escapeLike } from '../../utils/time.ts';

/*
 * The catalog's filters as SQL, shared by the list, its total and every facet count. Each
 * facet counts with its own filter left out, so picking "Tier 0" still shows how many Tier 1
 * applications there are to add.
 */

export type FacetName = 'domain' | 'team' | 'tier' | 'runtime' | 'lifecycle' | 'health';

/** The joins every catalog read starts from: a = application, g = group, d = domain. */
export const CATALOG_FROM = `
  pipeline_applications a
  join pipeline_groups g on g.id = a.group_id
  join pipeline_domains d on d.id = a.domain_id
  left join teams t on t.id = a.owner_team_id
  left join pipeline_repositories r on r.id = a.repository_id`;

function groupFilter(sql: SqlExecutor, values: readonly string[]) {
  const qualified = values.filter((value) => value.includes('/'));
  const plain = values.filter((value) => !value.includes('/'));
  return sql`and (
    (d.key || '/' || g.key) = any(${qualified}::text[]) or g.key = any(${plain}::text[]))`;
}

function teamFilter(sql: SqlExecutor, values: readonly string[]) {
  const ids = values.filter((value) => value !== 'none');
  const none = values.includes('none');
  return sql`and (a.owner_team_id = any(${ids}::uuid[]) or (${none} and a.owner_team_id is null))`;
}

function searchFilter(sql: SqlExecutor, q: string) {
  const pattern = `%${escapeLike(q.toLowerCase())}%`;
  return sql`and (
    lower(a.key || ' ' || a.name) like ${pattern}
    or ${q.toLowerCase()} = any(a.labels)
    or lower(coalesce(r.full_name, '')) like ${pattern})`;
}

/**
 * `and …` clauses for every filter that is set, except the facet named by `skip`. `me` is
 * the person asking, for "My teams"; without one, `mine` matches nothing.
 */
export function applicationWhere(
  sql: SqlExecutor,
  filters: ApplicationFilters,
  me: string | null,
  skip?: FacetName,
) {
  const parts = [sql`a.archived_at is null`];
  if (filters.q) parts.push(searchFilter(sql, filters.q));
  if (skip !== 'domain' && filters.domain?.length) {
    parts.push(sql`and d.key = any(${filters.domain}::text[])`);
  }
  if (filters.group?.length) parts.push(groupFilter(sql, filters.group));
  if (skip !== 'team' && filters.team?.length) parts.push(teamFilter(sql, filters.team));
  if (skip !== 'tier' && filters.tier?.length) {
    parts.push(sql`and a.tier = any(${filters.tier}::smallint[])`);
  }
  if (skip !== 'runtime' && filters.runtime?.length) {
    parts.push(sql`and a.runtime = any(${filters.runtime}::text[])`);
  }
  if (skip !== 'lifecycle' && filters.lifecycle?.length) {
    parts.push(sql`and a.lifecycle = any(${filters.lifecycle}::text[])`);
  }
  if (skip !== 'health' && filters.health?.length) {
    parts.push(sql`and a.health = any(${filters.health}::text[])`);
  }
  if (filters.label?.length) parts.push(sql`and a.labels @> ${filters.label}::text[]`);
  if (filters.mine) {
    parts.push(sql`and a.owner_team_id in (
      select team_id from team_members where user_id = ${me}::uuid)`);
  }
  if (filters.staleDays !== undefined) {
    parts.push(sql`and (a.last_deployed_at is null
      or a.last_deployed_at < now() - make_interval(days => ${filters.staleDays}::int))`);
  }
  return parts.reduce((all, part) => sql`${all} ${part}`);
}

/** The ORDER BY for a sort, and the keyset condition that resumes after the cursor's row. */
export function applicationOrder(sql: SqlExecutor, sort: ApplicationSort, after: string | null) {
  if (sort === 'recent') {
    const key = sql`coalesce(a.last_deployed_at, '-infinity'::timestamptz)`;
    return {
      after: after
        ? sql`and (${key}, a.id) < (
            select coalesce(last_deployed_at, '-infinity'::timestamptz), id
            from pipeline_applications where id = ${after}::uuid)`
        : sql``,
      order: sql`order by ${key} desc, a.id desc`,
    };
  }
  if (sort === 'tier') {
    return {
      after: after
        ? sql`and (a.tier, lower(a.name), a.id) > (
            select tier, lower(name), id from pipeline_applications where id = ${after}::uuid)`
        : sql``,
      order: sql`order by a.tier, lower(a.name), a.id`,
    };
  }
  return {
    after: after
      ? sql`and (lower(a.name), a.id) > (
          select lower(name), id from pipeline_applications where id = ${after}::uuid)`
      : sql``,
    order: sql`order by lower(a.name), a.id`,
  };
}

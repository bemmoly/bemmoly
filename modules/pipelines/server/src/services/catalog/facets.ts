import type { SqlExecutor } from '@bemmoly/core';
import type { ApplicationFacets, ApplicationFilters } from '../../../../shared/catalog.ts';
import type { FacetRow } from '../../models/catalog.ts';
import { applicationWhere, CATALOG_FROM, type FacetName } from './filters.ts';

/*
 * Facet counts for the catalog's filter panel, in one round trip: one grouped count per
 * facet, each with its own filter left out. Domain and team labels are their names (data);
 * tier, runtime, lifecycle and health labels are their values, which the web app words.
 */

/** Each facet's value and, aggregated per value, its label. */
const FACETS: ReadonlyArray<readonly [FacetName, string, string]> = [
  ['domain', 'd.key', 'min(d.name)'],
  ['team', "coalesce(a.owner_team_id::text, 'none')", 'min(t.name)'],
  ['tier', 'a.tier::text', 'min(a.tier::text)'],
  ['runtime', 'a.runtime', 'min(a.runtime)'],
  ['lifecycle', 'a.lifecycle', 'min(a.lifecycle)'],
  ['health', 'a.health', 'min(a.health)'],
];

export async function countFacets(
  sql: SqlExecutor,
  filters: ApplicationFilters,
  me: string | null,
): Promise<ApplicationFacets> {
  const parts = FACETS.map(
    ([facet, value, label]) => sql`
      (select ${facet}::text as facet, ${sql.unsafe(value)} as value,
        ${sql.unsafe(label)} as label,
        count(*)::int as count
      from ${sql.unsafe(CATALOG_FROM)}
      where ${applicationWhere(sql, filters, me, facet)}
      group by 2)`,
  );
  const union = parts.reduce((all, part) => sql`${all} union all ${part}`);
  const rows = await sql<FacetRow[]>`${union}`;
  const facets: ApplicationFacets = {
    domain: [],
    team: [],
    tier: [],
    runtime: [],
    lifecycle: [],
    health: [],
  };
  for (const row of rows) {
    const list = facets[row.facet as FacetName];
    list.push({
      value: row.value ?? 'none',
      label: row.label ?? row.value ?? '',
      count: row.count,
    });
  }
  for (const list of Object.values(facets)) list.sort((a, b) => b.count - a.count);
  facets.tier.sort((a, b) => a.value.localeCompare(b.value));
  return facets;
}

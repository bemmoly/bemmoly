import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import type { DocsPerson } from '../../../../shared/common.ts';
import type { HomePage } from '../../../../shared/home.ts';
import type { Breadcrumb } from '../../../../shared/pages.ts';
import type { DocsServiceDeps } from '../common.ts';
import { SUMMARY_COLUMNS, toSummary, type PageRow } from '../pages/rows.ts';

/*
 * What the Docs home's rows carry beyond a page summary. Ancestors and the
 * last body editor come back with the list's own query, as subselects on
 * indexed keys; the issue keys take one more query for the list's issue
 * edges and one batch lookup in Work, so a list costs the same at 5 rows or
 * 50. With Work off, or no issue edges, the extra query never runs.
 */

/** The summary columns plus the ancestors (root first) and the last body editor, from pages p. */
export const HOME_COLUMNS = `${SUMMARY_COLUMNS},
  (select coalesce(json_agg(json_build_object('id', a.id, 'title', a.title, 'icon', a.icon)
      order by length(a.path)), '[]'::json)
    from pages a
    where a.id = any(string_to_array(trim(both '/' from p.path), '/')::uuid[]) and a.id <> p.id
  ) as ancestors,
  (select json_build_object('id', u.id, 'name', u.name) from users u
    where u.id = coalesce(p.content_updated_by, p.created_by)) as last_editor`;

export interface HomeRow extends PageRow {
  ancestors: Breadcrumb[];
  last_editor: DocsPerson | null;
}

/** Issue keys per page, through the links graph and the kernel's entity registry. */
async function issueKeysByPage(
  deps: Pick<DocsServiceDeps, 'entities'>,
  sql: SqlExecutor,
  ctx: RequestContext,
  pageIds: readonly string[],
): Promise<Map<string, string[]>> {
  const entities = deps.entities;
  const byPage = new Map<string, string[]>();
  if (!entities || pageIds.length === 0) return byPage;
  if (entities.has && !entities.has('issue')) return byPage;
  const edges = await sql<{ source_id: string; target_id: string }[]>`
    select source_id, target_id, min(created_at) as first_linked from links
    where source_kind = 'page' and source_id = any(${[...pageIds]}::uuid[])
      and target_kind = 'issue'
    group by source_id, target_id
    order by first_linked, target_id`;
  if (edges.length === 0) return byPage;
  const ids = [...new Set(edges.map((edge) => edge.target_id))];
  const issues = entities.resolveMany
    ? await entities.resolveMany(
        'issue',
        ids.map((id) => ({ id })),
        ctx,
      )
    : (await Promise.all(ids.map((id) => entities.resolve('issue', { id }, ctx)))).filter(
        (issue) => issue !== null,
      );
  const keyOf = new Map(issues.map((issue) => [issue.id, issue.key ?? null]));
  for (const edge of edges) {
    const key = keyOf.get(edge.target_id);
    if (!key) continue;
    const keys = byPage.get(edge.source_id) ?? [];
    keys.push(key);
    byPage.set(edge.source_id, keys);
  }
  return byPage;
}

/** Turns a list's rows into home rows, with one more lookup at most for the issue keys. */
export async function toHomePages(
  deps: Pick<DocsServiceDeps, 'entities'>,
  sql: SqlExecutor,
  ctx: RequestContext,
  rows: readonly HomeRow[],
): Promise<HomePage[]> {
  const keys = await issueKeysByPage(
    deps,
    sql,
    ctx,
    rows.map((row) => row.id),
  );
  return rows.map((row) => ({
    ...toSummary(row),
    ancestors: row.ancestors ?? [],
    lastEditor: row.last_editor ?? null,
    issueKeys: keys.get(row.id) ?? [],
  }));
}

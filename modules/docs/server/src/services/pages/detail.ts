import type { SqlExecutor } from '@bemmoly/core';
import type { Breadcrumb, PageDetail } from '../../../../shared/pages.ts';
import { iso, isoOrNull } from '../common.ts';
import { toSummary, type PageRow } from './rows.ts';

/** Ancestor ids from the materialized path, root first, the page itself left out. */
export const ancestorIds = (row: Pick<PageRow, 'id' | 'path'>) =>
  row.path.split('/').filter((id) => id && id !== row.id);

/**
 * A page as the editor opens it: the row plus its breadcrumbs, labels,
 * owner and whether this person starred it, in three small indexed reads.
 */
export async function loadDetail(
  sql: SqlExecutor,
  row: PageRow,
  userId: string | null,
): Promise<PageDetail> {
  const ancestors = ancestorIds(row);
  const crumbs = ancestors.length
    ? await sql<{ id: string; title: string; icon: string | null }[]>`
        select id, title, icon from pages where id = any(${ancestors}::uuid[])`
    : [];
  const byId = new Map(crumbs.map((crumb) => [crumb.id, crumb]));
  const breadcrumbs: Breadcrumb[] = ancestors.flatMap((id) => {
    const crumb = byId.get(id);
    return crumb ? [{ id: crumb.id, title: crumb.title, icon: crumb.icon }] : [];
  });
  const labels = await sql<{ name: string }[]>`
    select name from page_labels where page_id = ${row.id} order by lower(name)`;
  const [extra] = await sql<{ starred: boolean; owner_name: string | null }[]>`
    select
      exists (select 1 from page_stars where page_id = ${row.id}
        and user_id = ${userId}::uuid) as starred,
      (select name from users where id = ${row.owner_id}::uuid) as owner_name`;
  return {
    ...toSummary(row),
    snapshot: row.snapshot,
    tldr: row.tldr,
    reviewers: row.reviewers,
    templateId: row.template_id,
    labels: labels.map((label) => label.name),
    starred: Boolean(extra?.starred),
    version: row.version,
    breadcrumbs,
    owner: row.owner_id && extra?.owner_name ? { id: row.owner_id, name: extra.owner_name } : null,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    publishedAt: isoOrNull(row.published_at),
    contentUpdatedAt: iso(row.content_updated_at),
  };
}

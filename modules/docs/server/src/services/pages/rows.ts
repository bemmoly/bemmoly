import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { PageStatus, RichText } from '../../../../shared/common.ts';
import type { PageSummary } from '../../../../shared/pages.ts';
import { iso, isoOrNull } from '../common.ts';

export interface PageRow {
  id: string;
  space_id: string;
  space_key: string;
  parent_id: string | null;
  position: string;
  path: string;
  title: string;
  icon: string | null;
  status: PageStatus;
  owner_id: string | null;
  reviewers: string[];
  template_id: string | null;
  snapshot: RichText | null;
  tldr: string | null;
  word_count: number;
  version: number;
  has_children: boolean;
  created_by: string | null;
  updated_by: string | null;
  published_at: Date | string | null;
  content_updated_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

/** "/a/b/c/" is three levels deep, so c sits at depth 2. */
export const depthOf = (path: string) => path.split('/').length - 3;

export const toSummary = (row: PageRow): PageSummary => ({
  id: row.id,
  spaceId: row.space_id,
  spaceKey: row.space_key,
  parentId: row.parent_id,
  position: row.position,
  depth: depthOf(row.path),
  title: row.title,
  icon: row.icon,
  status: row.status,
  ownerId: row.owner_id,
  hasChildren: row.has_children,
  wordCount: row.word_count,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  deletedAt: isoOrNull(row.deleted_at),
});

/**
 * Every page column a service reads, with the space key and whether the page
 * has live children, from pages p joined to spaces s. The snapshot is read
 * here too: a page's metadata and its document are one row.
 */
export const PAGE_COLUMNS = `p.id, p.space_id, s.key as space_key, p.parent_id, p.position,
  p.path, p.title, p.icon, p.status, p.owner_id, p.reviewers, p.template_id, p.snapshot, p.tldr,
  p.word_count, p.version, p.created_by, p.updated_by, p.published_at, p.content_updated_at,
  p.created_at, p.updated_at, p.deleted_at,
  exists (select 1 from pages c where c.parent_id = p.id and c.deleted_at is null) as has_children`;

/** The lighter list form: no snapshot, for trees and lists that never render the document. */
export const SUMMARY_COLUMNS = PAGE_COLUMNS.replace('p.snapshot, ', '');

/**
 * The page a page-scoped call starts from; a page in the trash is a 404
 * unless the caller asks for it (restore, the trash list).
 */
export async function pageById(
  sql: SqlExecutor,
  id: string,
  options: { deleted?: boolean; lock?: boolean } = {},
): Promise<PageRow> {
  const [row] = await sql<PageRow[]>`
    select ${sql.unsafe(PAGE_COLUMNS)}
    from pages p join spaces s on s.id = p.space_id
    where p.id = ${id}
      ${options.deleted ? sql`` : sql`and p.deleted_at is null`}
    ${options.lock ? sql`for update of p` : sql``}`;
  if (!row) throw new NotFoundError('The page was not found');
  return row;
}

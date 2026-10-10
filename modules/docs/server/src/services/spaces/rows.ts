import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { DocsPerson } from '../../../../shared/common.ts';
import type { Breadcrumb } from '../../../../shared/pages.ts';
import type { Space } from '../../../../shared/spaces.ts';
import { iso, isoOrNull } from '../common.ts';

export interface SpaceRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  team_id: string | null;
  project_id: string | null;
  ai_excluded: boolean;
  home_page_id: string | null;
  page_count: number | string;
  contributors: DocsPerson[] | null;
  member_count: number | string;
  top_pages: Breadcrumb[] | null;
  archived_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export const toSpace = (row: SpaceRow): Space => ({
  id: row.id,
  key: row.key,
  name: row.name,
  description: row.description,
  icon: row.icon,
  color: row.color,
  teamId: row.team_id,
  projectId: row.project_id,
  aiExcluded: row.ai_excluded,
  homePageId: row.home_page_id,
  pageCount: Number(row.page_count),
  contributors: row.contributors ?? [],
  memberCount: Number(row.member_count),
  topPages: row.top_pages ?? [],
  archivedAt: isoOrNull(row.archived_at),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

/**
 * The space columns plus its live page count, member count, the five
 * people who edited its pages most recently and its first three root pages
 * in tree order, read with the alias s, so a list of spaces (and the Docs
 * home's cards) stays one query.
 */
export const SPACE_COLUMNS = `s.id, s.key, s.name, s.description, s.icon, s.color, s.team_id,
  s.project_id, s.ai_excluded, s.home_page_id, s.archived_at, s.created_at, s.updated_at,
  (select count(*) from pages p where p.space_id = s.id and p.deleted_at is null) as page_count,
  (select count(*) from space_members m where m.space_id = s.id) as member_count,
  (select json_agg(json_build_object('id', u.id, 'name', u.name) order by c.last_edit desc)
    from (
      select coalesce(p.content_updated_by, p.created_by) as user_id,
        max(p.content_updated_at) as last_edit
      from pages p
      where p.space_id = s.id and p.deleted_at is null
        and coalesce(p.content_updated_by, p.created_by) is not null
      group by 1 order by 2 desc limit 5
    ) c join users u on u.id = c.user_id) as contributors,
  (select json_agg(json_build_object('id', t.id, 'title', t.title, 'icon', t.icon)
      order by t.position, t.id)
    from (
      select p.id, p.title, p.icon, p.position from pages p
      where p.space_id = s.id and p.parent_id is null and p.deleted_at is null
      order by p.position, p.id limit 3
    ) t) as top_pages`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The space a space-scoped call starts from. The URL segment is its key
 * ("ENG") or its id; a wrong one is a 404 before any capability check names it.
 */
export async function spaceByRef(sql: SqlExecutor, ref: string): Promise<SpaceRow> {
  const [row] = await sql<SpaceRow[]>`
    select ${sql.unsafe(SPACE_COLUMNS)} from spaces s
    where ${UUID.test(ref) ? sql`s.id = ${ref}::uuid` : sql`s.key = ${ref.trim().toUpperCase()}`}`;
  if (!row) throw new NotFoundError(`Space ${ref} was not found`);
  return row;
}

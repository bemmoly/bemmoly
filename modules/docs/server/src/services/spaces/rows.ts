import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
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
  archivedAt: isoOrNull(row.archived_at),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

/** The space columns plus its live page count, read with the alias s. */
export const SPACE_COLUMNS = `s.id, s.key, s.name, s.description, s.icon, s.color, s.team_id,
  s.project_id, s.ai_excluded, s.home_page_id, s.archived_at, s.created_at, s.updated_at,
  (select count(*) from pages p where p.space_id = s.id and p.deleted_at is null) as page_count`;

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

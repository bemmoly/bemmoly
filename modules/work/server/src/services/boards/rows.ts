import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import { boardConfigSchema, type Board, type BoardConfig } from '../../../../shared/boards.ts';
import { iso } from '../issues/deps.ts';

export interface BoardRow {
  id: string;
  project_id: string | null;
  origin_id: string | null;
  name: string;
  config: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

export const BOARD_COLUMNS = 'id, project_id, origin_id, name, config, created_at, updated_at';

/**
 * Stored configs are parsed on the way out, so a board written before a
 * field existed reads with that field's default instead of failing.
 */
export function parseConfig(value: unknown): BoardConfig {
  const parsed = boardConfigSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return boardConfigSchema.parse({
    columns: [
      { id: 'todo', name: 'To do', statusIds: [] },
      { id: 'done', name: 'Done', statusIds: [], done: true },
    ],
  });
}

export const toBoard = (row: BoardRow): Board => ({
  id: row.id,
  projectId: row.project_id,
  originId: row.origin_id,
  name: row.name,
  config: parseConfig(row.config),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

export async function loadBoard(
  sql: SqlExecutor,
  id: string,
  options: { lock?: boolean } = {},
): Promise<BoardRow> {
  const [row] = await sql<BoardRow[]>`
    select ${sql.unsafe(BOARD_COLUMNS)} from boards where id = ${id}
    ${options.lock ? sql`for update` : sql``}`;
  if (!row) throw new NotFoundError('The board was not found');
  return row;
}

export async function projectBoards(sql: SqlExecutor, projectId: string | null) {
  return sql<BoardRow[]>`
    select ${sql.unsafe(BOARD_COLUMNS)} from boards
    where ${projectId === null ? sql`project_id is null` : sql`project_id = ${projectId}`}
    order by id`;
}

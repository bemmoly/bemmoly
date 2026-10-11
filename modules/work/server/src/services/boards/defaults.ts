import type { SqlExecutor } from '@bemmoly/core';
import { defaultBoardConfig } from '../../../../shared/board-defaults.ts';
import type { BoardConfig } from '../../../../shared/boards.ts';
import { projectStatuses, type PlanningProject, type StatusRow } from './context.ts';
import { BOARD_COLUMNS, parseConfig, projectBoards, type BoardRow } from './rows.ts';

/*
 * A project has a board from its first read. It starts as a copy of the org
 * default board scheme when there is one, matched to the project's statuses
 * by name, or else as one column per status with the done statuses together.
 */

/** One column per open status in workflow order, then one Done column for every done status. */
export const defaultConfig = (statuses: readonly StatusRow[]): BoardConfig =>
  defaultBoardConfig(statuses);

/**
 * The org scheme's columns re-pointed at a project's statuses by name. Columns
 * whose statuses the project lacks are dropped; null when too few remain.
 */
export function adoptConfig(
  scheme: BoardConfig,
  schemeStatusNames: ReadonlyMap<string, string>,
  statuses: readonly StatusRow[],
): BoardConfig | null {
  const byName = new Map(statuses.map((status) => [status.name.toLowerCase(), status.id]));
  const columns = scheme.columns
    .map((column) => ({
      ...column,
      statusIds: column.statusIds
        .map((id) => byName.get(schemeStatusNames.get(id)?.toLowerCase() ?? ''))
        .filter((id): id is string => Boolean(id)),
    }))
    .filter((column) => column.statusIds.length > 0);
  if (columns.length < 2) return null;
  return { ...scheme, columns };
}

async function statusNames(sql: SqlExecutor, config: BoardConfig) {
  const ids = config.columns.flatMap((column) => column.statusIds);
  const rows = await sql<{ id: string; name: string }[]>`
    select id, name from workflow_statuses where id = any(${ids}::uuid[])`;
  return new Map(rows.map((row) => [row.id, row.name]));
}

/**
 * The project's boards, creating its first one when it has none. The
 * advisory lock makes two first reads in flight create one board, not two.
 */
export async function ensureProjectBoards(
  tx: SqlExecutor,
  project: PlanningProject,
): Promise<{ rows: BoardRow[]; created: BoardRow | null }> {
  const existing = await projectBoards(tx, project.id);
  if (existing.length > 0) return { rows: existing, created: null };
  await tx`select pg_advisory_xact_lock(hashtext(${`work.board:${project.id}`}))`;
  const again = await projectBoards(tx, project.id);
  if (again.length > 0) return { rows: again, created: null };
  const statuses = await projectStatuses(tx, project.id);
  const [scheme] = await projectBoards(tx, null);
  let config = defaultConfig(statuses);
  if (scheme) {
    const schemeConfig = parseConfig(scheme.config);
    config = adoptConfig(schemeConfig, await statusNames(tx, schemeConfig), statuses) ?? config;
  }
  const [row] = await tx<BoardRow[]>`
    insert into boards (project_id, origin_id, name, config)
    values (${project.id}, ${scheme?.id ?? null}, ${`${project.key} board`},
      ${JSON.stringify(config)}::jsonb)
    returning ${tx.unsafe(BOARD_COLUMNS)}`;
  return { rows: row ? [row] : [], created: row ?? null };
}

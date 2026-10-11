import type { SqlExecutor } from '@bemmoly/core';
import { inheritedBoardConfig, schemeState } from '../schemes/compare.ts';
import { PROJECT_COLUMNS, type ProjectRow } from '../projects/rows.ts';
import { publishPlanningChange, type PlanningDeps } from './context.ts';
import { defaultConfig } from './defaults.ts';
import { BOARD_COLUMNS, projectBoards, type BoardRow } from './rows.ts';

/*
 * Every project holds its own copy of the board, so a change to the org
 * default board has to be carried to the projects that follow it: those with
 * no override mark whose board still matches what they inherited. A project
 * that changed its board, or overrode it, keeps its own.
 */

export const ORG_BOARD_NAME = 'Workspace board';

/** The projects whose board is the org default as is, worked out before the default changes. */
export async function boardFollowers(tx: SqlExecutor): Promise<string[]> {
  const projects = await tx<ProjectRow[]>`
    select ${tx.unsafe(PROJECT_COLUMNS)} from projects
    where id in (select project_id from boards where project_id is not null)
    order by id`;
  const followers: string[] = [];
  for (const project of projects) {
    if (!(await schemeState(tx, project, 'board')).overridden) followers.push(project.id);
  }
  return followers;
}

/** Gives each follower the board it now inherits, and tells its open boards to refetch. */
async function carryToFollowers(
  deps: Pick<PlanningDeps, 'realtime'>,
  tx: SqlExecutor,
  followers: readonly string[],
): Promise<void> {
  for (const projectId of followers) {
    const { config } = await inheritedBoardConfig(tx, projectId);
    const updated = await tx<{ id: string }[]>`
      update boards set config = ${JSON.stringify(config)}::jsonb, updated_at = now()
      where project_id = ${projectId}
      returning id`;
    await publishPlanningChange(deps, tx, projectId, { boardIds: updated.map((row) => row.id) });
  }
}

/**
 * Runs a change to the org default board inside `tx` and carries it to every project that
 * followed the default before the change.
 */
export async function changeOrgDefaultBoard<T>(
  deps: Pick<PlanningDeps, 'realtime'>,
  tx: SqlExecutor,
  change: () => Promise<T>,
): Promise<T> {
  await tx`select pg_advisory_xact_lock(hashtext('work.board:org'))`;
  const followers = await boardFollowers(tx);
  const result = await change();
  await carryToFollowers(deps, tx, followers);
  return result;
}

/** The statuses the org default board maps: those of the org default workflows. */
export async function orgStatuses(tx: SqlExecutor) {
  return tx<{ id: string; name: string; category: 'todo'; position: number }[]>`
    select s.id, s.name, s.category, s.position from workflow_statuses s
    join workflows w on w.id = s.workflow_id where w.project_id is null
    order by w.id, s.position, s.id`;
}

/**
 * The org default board, created on first read from the org default workflow so the org
 * page always has one to edit. The lock makes two first reads create one board, not two.
 */
export async function ensureOrgBoard(
  deps: Pick<PlanningDeps, 'realtime'>,
  tx: SqlExecutor,
): Promise<BoardRow[]> {
  const existing = await projectBoards(tx, null);
  if (existing.length > 0) return existing;
  return changeOrgDefaultBoard(deps, tx, async () => {
    const again = await projectBoards(tx, null);
    if (again.length > 0) return again;
    const config = defaultConfig(await orgStatuses(tx));
    return tx<BoardRow[]>`
      insert into boards (project_id, name, config)
      values (null, ${ORG_BOARD_NAME}, ${JSON.stringify(config)}::jsonb)
      returning ${tx.unsafe(BOARD_COLUMNS)}`;
  });
}

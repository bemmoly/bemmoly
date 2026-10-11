import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import {
  loadStatuses,
  loadTransitions,
  WORKFLOW_COLUMNS,
  type StatusRow,
  type WorkflowRow,
} from './rows.ts';

/*
 * A project's own workflow is a copy of the org default. Its issues and its
 * board columns name status ids, so taking the copy and dropping it both
 * move them: onto the copy's statuses, and back onto the org default's by
 * name, then by category, so no issue is left in a status that is gone.
 */

export async function orgWorkflow(sql: SqlExecutor): Promise<WorkflowRow> {
  const [row] = await sql<WorkflowRow[]>`
    select ${sql.unsafe(WORKFLOW_COLUMNS)} from workflows
    where project_id is null order by id limit 1`;
  if (!row) throw new NotFoundError('There is no org default workflow');
  return row;
}

export async function ownWorkflow(
  sql: SqlExecutor,
  projectId: string,
): Promise<WorkflowRow | null> {
  const [row] = await sql<WorkflowRow[]>`
    select ${sql.unsafe(WORKFLOW_COLUMNS)} from workflows
    where project_id = ${projectId} order by id limit 1`;
  return row ?? null;
}

/** Moves a project's issues and board columns from one set of status ids to another. */
export async function remapProjectStatuses(
  tx: SqlExecutor,
  projectId: string,
  map: ReadonlyMap<string, string>,
): Promise<void> {
  if (map.size === 0) return;
  const from = [...map.keys()];
  const to = from.map((id) => map.get(id) as string);
  await tx`
    update issues i set status_id = m.target
    from unnest(${from}::uuid[], ${to}::uuid[]) as m(source, target)
    where i.project_id = ${projectId} and i.status_id = m.source`;
  const boards = await tx<{ id: string; config: { columns?: { statusIds?: string[] }[] } }[]>`
    select id, config from boards where project_id = ${projectId}`;
  for (const board of boards) {
    const columns = (board.config.columns ?? []).map((column) => ({
      ...column,
      statusIds: [...new Set((column.statusIds ?? []).map((id) => map.get(id) ?? id))],
    }));
    await tx`
      update boards set config = ${JSON.stringify({ ...board.config, columns })}::jsonb,
        updated_at = now()
      where id = ${board.id}`;
  }
}

/** Copies statuses with fresh ids, then transitions remapped onto them; returns old id to new. */
export async function copyContent(
  tx: SqlExecutor,
  fromId: string,
  toId: string,
): Promise<Map<string, string>> {
  const statuses = await loadStatuses(tx, fromId);
  const ids = new Map<string, string>();
  for (const status of statuses) {
    const [row] = await tx<{ id: string }[]>`
      insert into workflow_statuses (workflow_id, name, category, color, position, allowed_role_ids,
        x, y)
      values (${toId}, ${status.name}, ${status.category}, ${status.color}, ${status.position},
        ${status.allowed_role_ids}, ${status.x}, ${status.y})
      returning id`;
    if (row) ids.set(status.id, row.id);
  }
  for (const transition of await loadTransitions(tx, fromId)) {
    await tx`
      insert into workflow_transitions (workflow_id, from_status_id, to_status_id, name, rules,
        position)
      values (${toId},
        ${transition.from_status_id ? (ids.get(transition.from_status_id) ?? null) : null},
        ${ids.get(transition.to_status_id) ?? null}, ${transition.name},
        ${JSON.stringify(transition.rules)}::jsonb, ${transition.position})`;
  }
  return ids;
}

/** The project's copy of the org default, published as its version 1, with issues moved onto it. */
export async function copyWorkflowToProject(
  tx: SqlExecutor,
  project: { id: string; key: string },
  name?: string,
): Promise<WorkflowRow> {
  const origin = await orgWorkflow(tx);
  const [row] = await tx<WorkflowRow[]>`
    insert into workflows (project_id, origin_id, name, published_version, published_at, draft)
    values (${project.id}, ${origin.id}, ${name ?? `${origin.name} (${project.key})`}, 1,
      now(), null)
    returning ${tx.unsafe(WORKFLOW_COLUMNS)}`;
  if (!row) throw new NotFoundError('The workflow was not stored');
  const map = await copyContent(tx, origin.id, row.id);
  await remapProjectStatuses(tx, project.id, map);
  return row;
}

/** Where each of the copy's statuses goes back to: same name, else same category, else the first. */
export function returnMap(
  own: readonly StatusRow[],
  org: readonly StatusRow[],
): Map<string, string> {
  const map = new Map<string, string>();
  const first = org[0];
  for (const status of own) {
    const target =
      org.find((candidate) => candidate.name.toLowerCase() === status.name.toLowerCase()) ??
      org.find((candidate) => candidate.category === status.category) ??
      first;
    if (target) map.set(status.id, target.id);
  }
  return map;
}

/** Drops the project's copy after moving its issues and board columns back to the org default. */
export async function dropProjectWorkflow(tx: SqlExecutor, projectId: string): Promise<void> {
  const own = await ownWorkflow(tx, projectId);
  if (!own) return;
  const origin = await orgWorkflow(tx);
  const map = returnMap(await loadStatuses(tx, own.id), await loadStatuses(tx, origin.id));
  await remapProjectStatuses(tx, projectId, map);
  await tx`delete from workflows where id = ${own.id}`;
}

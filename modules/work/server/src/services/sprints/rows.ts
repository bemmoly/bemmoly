import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { SprintState } from '../../../../shared/enums.ts';
import { sprintSnapshotSchema, type Sprint } from '../../../../shared/sprints.ts';
import { iso } from '../issues/deps.ts';

export interface SprintRow {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  state: SprintState;
  capacity_points: string | number | null;
  completed_snapshot: unknown;
  started_at: Date | string | null;
  closed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export const SPRINT_COLUMNS = `id, project_id, name, goal, starts_at, ends_at, state,
  capacity_points, completed_snapshot, started_at, closed_at, created_at, updated_at`;

const isoOrNull = (value: Date | string | null): string | null => (value ? iso(value) : null);

export const toSprint = (row: SprintRow): Sprint => {
  const snapshot = sprintSnapshotSchema.safeParse(row.completed_snapshot);
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    goal: row.goal,
    startsAt: isoOrNull(row.starts_at),
    endsAt: isoOrNull(row.ends_at),
    state: row.state,
    capacityPoints: row.capacity_points === null ? null : Number(row.capacity_points),
    completedSnapshot: snapshot.success ? snapshot.data : null,
    startedAt: isoOrNull(row.started_at),
    closedAt: isoOrNull(row.closed_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
};

export async function loadSprint(
  sql: SqlExecutor,
  id: string,
  options: { lock?: boolean } = {},
): Promise<SprintRow> {
  const [row] = await sql<SprintRow[]>`
    select ${sql.unsafe(SPRINT_COLUMNS)} from sprints where id = ${id}
    ${options.lock ? sql`for update` : sql``}`;
  if (!row) throw new NotFoundError('The sprint was not found');
  return row;
}

/** The sprint running in a project, if any; Scrum allows one at a time. */
export async function activeSprint(
  sql: SqlExecutor,
  projectId: string,
): Promise<SprintRow | undefined> {
  const [row] = await sql<SprintRow[]>`
    select ${sql.unsafe(SPRINT_COLUMNS)} from sprints
    where project_id = ${projectId} and state = 'active'
    order by started_at, id limit 1`;
  return row;
}

/** Future and active sprints in planning order: the active one, then by start date. */
export async function openSprints(sql: SqlExecutor, projectId: string): Promise<SprintRow[]> {
  return sql<SprintRow[]>`
    select ${sql.unsafe(SPRINT_COLUMNS)} from sprints
    where project_id = ${projectId} and state <> 'closed'
    order by state = 'active' desc, starts_at nulls last, id`;
}

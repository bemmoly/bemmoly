import { HttpStatusError, type ImportRunContext, type SqlClient } from '@bemmoly/core';
import { boardConfigSchema, type BoardColumn } from '../../../../../shared/boards.ts';
import type { JiraBoard, JiraClient, JiraSprint } from '../../../clients/jira.ts';
import { defaultConfig } from '../../boards/defaults.ts';
import { projectStatuses } from '../../boards/context.ts';
import type { ProjectSetup } from './project-setup.ts';

/*
 * A project's boards and sprints. Each board keeps its name and its columns, re-pointed at
 * the statuses the project now has; a board with too few mappable columns starts from Work's
 * default. Sprints come from every scrum board, once each, with their dates and state.
 */

const SPRINT_STATES: Record<string, 'future' | 'active' | 'closed'> = {
  future: 'future',
  active: 'active',
  closed: 'closed',
};

/** A board that cannot have sprints answers 400; it simply has none. */
async function sprintsOf(client: JiraClient, board: JiraBoard): Promise<JiraSprint[]> {
  if (board.type && board.type !== 'scrum') return [];
  try {
    return await client.sprints(board.id);
  } catch (error) {
    if (error instanceof HttpStatusError && error.status === 400) return [];
    throw error;
  }
}

function columnsFor(
  columns: Awaited<ReturnType<JiraClient['boardColumns']>>,
  setup: ProjectSetup,
): BoardColumn[] {
  const taken = new Set<string>();
  return columns
    .map((column, index) => {
      const statusIds = [
        ...new Set(
          column.statuses
            .map((status) => setup.statuses.get(status.id)?.id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      let id =
        column.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || `column-${index + 1}`;
      while (taken.has(id)) id = `${id}-${index + 1}`;
      taken.add(id);
      const done =
        statusIds.length > 0 &&
        statusIds.every(
          (statusId) =>
            [...setup.statuses.values()].find((status) => status.id === statusId)?.category ===
            'done',
        );
      return { id, name: column.name.slice(0, 40) || 'Column', statusIds, wipLimit: null, done };
    })
    .filter((column) => column.statusIds.length > 0)
    .slice(0, 20);
}

async function writeSprint(
  sql: SqlClient,
  projectId: string,
  sprint: JiraSprint,
  existing: string | null,
) {
  const state = SPRINT_STATES[sprint.state ?? ''] ?? 'future';
  const startsAt = sprint.startDate ?? null;
  const endsAt = sprint.endDate && (!startsAt || sprint.endDate > startsAt) ? sprint.endDate : null;
  const values = {
    name: sprint.name.slice(0, 120) || `Sprint ${sprint.id}`,
    goal: sprint.goal?.slice(0, 2000) || null,
    state,
    startedAt: state === 'future' ? null : startsAt,
    closedAt: state === 'closed' ? (sprint.completeDate ?? endsAt) : null,
  };
  if (existing) {
    const [row] = await sql<{ id: string }[]>`
      update sprints set name = ${values.name}, goal = ${values.goal}, state = ${state},
        starts_at = ${startsAt}::timestamptz, ends_at = ${endsAt}::timestamptz,
        started_at = ${values.startedAt}::timestamptz, closed_at = ${values.closedAt}::timestamptz,
        updated_at = now()
      where id = ${existing} returning id`;
    if (row) return { id: row.id, created: false };
  }
  const [row] = await sql<{ id: string }[]>`
    insert into sprints (project_id, name, goal, state, starts_at, ends_at, started_at, closed_at)
    values (${projectId}, ${values.name}, ${values.goal}, ${state}, ${startsAt}::timestamptz,
      ${endsAt}::timestamptz, ${values.startedAt}::timestamptz, ${values.closedAt}::timestamptz)
    returning id`;
  return { id: row!.id, created: true };
}

/** Boards and sprints of one project; returns Jira sprint id to Work sprint id. */
export async function importAgile(
  sql: SqlClient,
  client: JiraClient,
  setup: ProjectSetup,
  ctx: ImportRunContext,
): Promise<Map<string, string>> {
  let boards: JiraBoard[];
  try {
    boards = await client.boards(setup.jira.key);
  } catch (error) {
    if (error instanceof HttpStatusError && (error.status === 404 || error.status === 403)) {
      ctx.report.warn('Boards and sprints were not readable with this token; they were skipped.');
      return new Map();
    }
    throw error;
  }
  const sprints = new Map<string, string>();
  const knownBoards = await ctx.mappings.getMany(
    'board',
    boards.map((board) => String(board.id)),
  );
  for (const board of boards) {
    const statuses = await projectStatuses(sql, setup.projectId);
    const columns = columnsFor(await client.boardColumns(board.id), setup);
    const config =
      columns.length >= 2 ? boardConfigSchema.parse({ columns }) : defaultConfig(statuses);
    const existing = knownBoards.get(String(board.id))?.targetId ?? null;
    const [row] = existing
      ? await sql<{ id: string }[]>`
          update boards set name = ${board.name.slice(0, 120)}, config = ${JSON.stringify(config)}::jsonb, updated_at = now()
          where id = ${existing} returning id`
      : await sql<{ id: string }[]>`
          insert into boards (project_id, name, config)
          values (${setup.projectId}, ${board.name.slice(0, 120) || `${setup.key} board`}, ${JSON.stringify(config)}::jsonb)
          returning id`;
    if (row) {
      await ctx.mappings.set('board', String(board.id), row.id);
      ctx.report.count('boards', existing ? 'updated' : 'created');
    }
    for (const sprint of await sprintsOf(client, board)) {
      const sourceId = String(sprint.id);
      if (sprints.has(sourceId)) continue;
      const mapped = await ctx.mappings.get('sprint', sourceId);
      const written = await writeSprint(sql, setup.projectId, sprint, mapped?.targetId ?? null);
      sprints.set(sourceId, written.id);
      await ctx.mappings.set('sprint', sourceId, written.id);
      ctx.report.count('sprints', written.created ? 'created' : 'updated');
    }
  }
  return sprints;
}

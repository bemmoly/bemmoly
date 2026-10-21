import type { RequestContext } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import type {
  Backlog,
  BacklogQuery,
  EpicProgress,
  MoveIssueBody,
} from '../../../../shared/backlog.ts';
import type { Issue } from '../../../../shared/issues.ts';
import { resolveProject, type PlanningDeps } from '../boards/context.ts';
import { parseConfig, projectBoards } from '../boards/rows.ts';
import { projectResource, requireDatabase } from '../issues/deps.ts';
import { createIssuesService } from '../issues/index.ts';
import { ISSUE_COLUMNS, loadIssueByKey, toIssue, type IssueRow } from '../issues/rows.ts';
import { statusSets } from '../metrics/load.ts';
import { openSprints, toSprint } from '../sprints/rows.ts';
import { groupBacklog } from './group.ts';
import { compileListOrder, orderWithRank } from './order.ts';

interface EpicRow {
  id: string;
  key: string;
  title: string;
  status_id: string;
  color: string | null;
  done: number;
  total: number;
  done_points: string;
  total_points: string;
}

/**
 * The Backlog screen: open sprints with their issues and committed points,
 * the backlog itself, and the epic panel, in three statements; and the drop
 * that moves an issue between those containers.
 */
export function createBacklogService(deps: PlanningDeps) {
  const issues = createIssuesService(deps);

  return {
    async get(ctx: RequestContext, projectRef: string, query: BacklogQuery = {}): Promise<Backlog> {
      const sql = requireDatabase(deps);
      const project = await resolveProject(sql, projectRef);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(project.id));
      const [boards, sprintRows] = await Promise.all([
        projectBoards(sql, project.id),
        openSprints(sql, project.id),
      ]);
      const sprintIds = sprintRows.map((sprint) => sprint.id);
      const board = query.boardId ? boards.find((row) => row.id === query.boardId) : boards[0];
      if (query.boardId && !board) throw new NotFoundError('The board is not one of this project');
      const config = board ? parseConfig(board.config) : null;
      const order = await compileListOrder(
        sql,
        deps.lql,
        ctx,
        project.id,
        config?.backlog.sortRules ?? [],
        query.q,
      );
      const [sets, rows, epics, blockers] = await Promise.all([
        statusSets(sql, project.id, config),
        // Ordered and filtered in a CTE over `issues` itself, the table the LQL names.
        sql<(IssueRow & { matches: boolean })[]>`
          with listed as (
            select issues.id, (${order.filter ?? sql`true`}) as matches,
              row_number() over (order by ${orderWithRank(sql, order.keys)}) as position
            from issues
            where issues.project_id = ${project.id} and issues.deleted_at is null
              and issues.archived_at is null
              and (issues.sprint_id is null or issues.sprint_id = any(${sprintIds}::uuid[]))
              and not exists (select 1 from issue_types t
                where t.id = issues.type_id and t.level = 'epic')
          )
          select ${sql.unsafe(ISSUE_COLUMNS)}, listed.matches
          from listed join issues i on i.id = listed.id
          order by listed.position`,
        sql<EpicRow[]>`
          select e.id, e.key, e.title, e.status_id, e.color,
            count(c.id)::int as total,
            (count(c.id) filter (where cs.category = 'done'))::int as done,
            coalesce(sum(c.estimate), 0) as total_points,
            coalesce(sum(c.estimate) filter (where cs.category = 'done'), 0) as done_points
          from issues e
          join issue_types et on et.id = e.type_id and et.level = 'epic'
          join workflow_statuses es on es.id = e.status_id
          left join issues c on c.parent_id = e.id and c.deleted_at is null
          left join workflow_statuses cs on cs.id = c.status_id
          where e.project_id = ${project.id} and e.deleted_at is null and e.archived_at is null
            and es.category <> 'done'
          group by e.id
          order by e.rank, e.id`,
        sql<{ target_id: string; keys: string[] }[]>`
          select bl.target_id, array_agg(bi.key order by bi.key) as keys
          from issue_links bl
          join issues t on t.id = bl.target_id and t.project_id = ${project.id}
            and t.deleted_at is null
          join issues bi on bi.id = bl.source_id and bi.deleted_at is null
          join workflow_statuses bs on bs.id = bi.status_id and bs.category <> 'done'
          where bl.kind = 'blocks'
          group by bl.target_id`,
      ]);
      const matching = new Set(rows.filter((row) => row.matches).map((row) => row.id));
      const grouped = groupBacklog(
        sprintRows.map(toSprint),
        rows.map(toIssue),
        sets.done,
        matching,
      );
      return {
        projectId: project.id,
        ...grouped,
        sorted: order.keys.length > 0,
        boardId: board?.id ?? null,
        blocked: Object.fromEntries(blockers.map((row) => [row.target_id, row.keys])),
        epics: epics.map((epic): EpicProgress => ({
          id: epic.id,
          key: epic.key,
          title: epic.title,
          statusId: epic.status_id,
          color: epic.color,
          done: epic.done,
          total: epic.total,
          donePoints: Number(epic.done_points),
          totalPoints: Number(epic.total_points),
        })),
      };
    },

    /**
     * Drops an issue between two neighbours, into a sprint, the backlog
     * (sprintId null) or its current container (sprintId absent). The target
     * sprint must be an open sprint of the issue's project; the rank and the
     * history row are the issue service's.
     */
    async move(ctx: RequestContext, key: string, body: MoveIssueBody): Promise<Issue> {
      if (body.sprintId) {
        const sql = requireDatabase(deps);
        const issue = await loadIssueByKey(sql, key);
        const [sprint] = await sql<{ project_id: string; state: string }[]>`
          select project_id, state from sprints where id = ${body.sprintId}`;
        if (!sprint || sprint.project_id !== issue.project_id) {
          throw new ValidationError('The sprint is not part of this project');
        }
        if (sprint.state === 'closed') throw new ValidationError('The sprint is closed');
      }
      return issues.rank(ctx, key, body);
    },
  };
}

export type BacklogService = ReturnType<typeof createBacklogService>;

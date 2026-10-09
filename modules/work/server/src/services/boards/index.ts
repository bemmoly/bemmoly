import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import type { CapabilityName } from '@bemmoly/shared';
import {
  boardConfigSchema,
  type Board,
  type BoardConfig,
  type BoardView,
  type BoardViewQuery,
  type CreateBoardBody,
  type UpdateBoardBody,
} from '../../../../shared/boards.ts';
import { MODULE_RESOURCE, projectResource, requireDatabase } from '../issues/deps.ts';
import { configProblems, configQueries, onlyWipChanged, rejectProblems } from './config.ts';
import {
  audit,
  projectStatuses,
  publishPlanningChange,
  resolveProject,
  type PlanningDeps,
} from './context.ts';
import { defaultConfig, ensureProjectBoards } from './defaults.ts';
import { BOARD_COLUMNS, loadBoard, projectBoards, toBoard, type BoardRow } from './rows.ts';
import { buildBoardView } from './view.ts';

export type { PlanningDeps } from './context.ts';

const resourceOf = (projectId: string | null) =>
  projectId ? projectResource(projectId) : MODULE_RESOURCE;

/** Statuses a board in this scope may map: the project's workflow, or the org default ones. */
async function allowedStatuses(sql: SqlExecutor, projectId: string | null) {
  if (projectId) return projectStatuses(sql, projectId);
  return sql<{ id: string; name: string; category: 'todo'; position: number }[]>`
    select s.id, s.name, s.category, s.position from workflow_statuses s
    join workflows w on w.id = s.workflow_id where w.project_id is null
    order by w.id, s.position, s.id`;
}

/** Board configuration: columns, WIP, lanes, quick filters, cards and colours, and the view. */
export function createBoardsService(deps: PlanningDeps) {
  async function validate(sql: SqlExecutor, projectId: string | null, config: BoardConfig) {
    const statuses = await allowedStatuses(sql, projectId);
    rejectProblems(configProblems(config, new Set(statuses.map((status) => status.id))));
    const queries = configQueries(config);
    if (queries.length === 0) return;
    const catalog = await deps.lql.catalog(projectId);
    for (const { query } of queries) deps.lql.parse(query, catalog);
  }

  async function authorizeWrite(
    ctx: RequestContext,
    projectId: string | null,
    capability: CapabilityName,
  ) {
    await ctx.authz.authorize(ctx.actor, capability, resourceOf(projectId));
  }

  /** A project's boards; a project's first read creates its board from the org scheme. */
  async function listForProject(ctx: RequestContext, projectRef: string): Promise<Board[]> {
    const sql = requireDatabase(deps);
    const project = await resolveProject(sql, projectRef);
    await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(project.id));
    const rows = await sql.begin(async (tx) => {
      const { rows: boards, created } = await ensureProjectBoards(tx, project);
      if (created) await publishPlanningChange(deps, tx, project.id, { boardIds: [created.id] });
      return boards;
    });
    return (rows as BoardRow[]).map(toBoard);
  }

  return {
    listForProject,

    /** Boards of a project by id, or the org default board scheme without one. */
    async list(ctx: RequestContext, projectId: string | undefined): Promise<Board[]> {
      if (projectId) return listForProject(ctx, projectId);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', MODULE_RESOURCE);
      return (await projectBoards(requireDatabase(deps), null)).map(toBoard);
    },

    async get(ctx: RequestContext, id: string): Promise<Board> {
      const row = await loadBoard(requireDatabase(deps), id);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', resourceOf(row.project_id));
      return toBoard(row);
    },

    async create(ctx: RequestContext, body: CreateBoardBody): Promise<Board> {
      const sql = requireDatabase(deps);
      const project = body.projectId ? await resolveProject(sql, body.projectId) : null;
      const projectId = project?.id ?? null;
      await authorizeWrite(ctx, projectId, 'work.board.configure');
      const config = body.config
        ? boardConfigSchema.parse(body.config)
        : defaultConfig(await allowedStatuses(sql, projectId));
      await validate(sql, projectId, config);
      const row = await sql.begin(async (tx) => {
        const [created] = await tx<BoardRow[]>`
          insert into boards (project_id, name, config)
          values (${projectId}, ${body.name}, ${JSON.stringify(config)}::jsonb)
          returning ${tx.unsafe(BOARD_COLUMNS)}`;
        const board = toBoard(created as BoardRow);
        await audit(deps, ctx, tx, {
          action: 'board.created',
          target: { kind: 'board', id: board.id },
          after: board,
        });
        await publishPlanningChange(deps, tx, projectId, { boardIds: [board.id] });
        return created as BoardRow;
      });
      return toBoard(row as BoardRow);
    },

    /**
     * Saves a board's name or config. A change to WIP limits alone needs only
     * "Edit WIP limits"; anything else needs "Configure board".
     */
    async update(ctx: RequestContext, id: string, body: UpdateBoardBody): Promise<Board> {
      const sql = requireDatabase(deps);
      const current = await loadBoard(sql, id);
      const before = toBoard(current);
      const config = body.config ? boardConfigSchema.parse(body.config) : before.config;
      const wipOnly = body.name === undefined && onlyWipChanged(before.config, config);
      await authorizeWrite(
        ctx,
        current.project_id,
        wipOnly ? 'work.board.wip' : 'work.board.configure',
      );
      if (body.config) await validate(sql, current.project_id, config);
      const row = await sql.begin(async (tx) => {
        await loadBoard(tx, id, { lock: true });
        const [updated] = await tx<BoardRow[]>`
          update boards set name = ${body.name ?? before.name},
            config = ${JSON.stringify(config)}::jsonb, updated_at = now()
          where id = ${id}
          returning ${tx.unsafe(BOARD_COLUMNS)}`;
        await audit(deps, ctx, tx, {
          action: 'board.updated',
          target: { kind: 'board', id },
          before,
          after: toBoard(updated as BoardRow),
        });
        await publishPlanningChange(deps, tx, current.project_id, { boardIds: [id] });
        return updated as BoardRow;
      });
      return toBoard(row as BoardRow);
    },

    async remove(ctx: RequestContext, id: string): Promise<void> {
      const sql = requireDatabase(deps);
      const current = await loadBoard(sql, id);
      await authorizeWrite(ctx, current.project_id, 'work.board.configure');
      await sql.begin(async (tx) => {
        await tx`delete from boards where id = ${id}`;
        await tx`delete from sprint_metrics where scope_kind = 'board' and scope_id = ${id}`;
        await audit(deps, ctx, tx, {
          action: 'board.deleted',
          target: { kind: 'board', id },
          before: toBoard(current),
        });
        await publishPlanningChange(deps, tx, current.project_id, { boardIds: [id] });
      });
    },

    /** Columns, lanes and cards in rank order, narrowed by an optional LQL quick filter. */
    async view(ctx: RequestContext, id: string, query: BoardViewQuery): Promise<BoardView> {
      const sql = requireDatabase(deps);
      const board = await loadBoard(sql, id);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', resourceOf(board.project_id));
      if (!board.project_id) {
        return {
          board: toBoard(board),
          sprintId: null,
          columns: [],
          lanes: [],
          cards: [],
          metrics: {
            throughputPerWeek: 0,
            cycleTimeDays: null,
            wipCount: 0,
            committedPoints: 0,
            completedPoints: 0,
            throughputHistory: [],
          },
        };
      }
      const project = await resolveProject(sql, board.project_id);
      return buildBoardView(deps, ctx, sql, board, project, query);
    },
  };
}

export type BoardsService = ReturnType<typeof createBoardsService>;

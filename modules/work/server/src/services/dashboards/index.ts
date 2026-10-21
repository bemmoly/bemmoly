import { randomUUID } from 'node:crypto';
import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { ForbiddenError, NotFoundError, ValidationError } from '@bemmoly/shared';
import {
  dashboardWidgetSchema,
  defaultDashboardWidgets,
  MAX_DASHBOARD_WIDGETS,
  type AddDashboardWidgetBody,
  type CreateDashboardBody,
  type Dashboard,
  type DashboardWidget,
  type DashboardWidgetInput,
  type ListDashboardsQuery,
  type UpdateDashboardBody,
} from '../../../../shared/dashboards.ts';
import { resolveProject, type PlanningDeps } from '../boards/context.ts';
import { actorUserId, iso, projectResource, requireDatabase } from '../issues/deps.ts';

interface DashboardRow {
  id: string;
  owner_id: string;
  project_id: string;
  name: string;
  widgets: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = 'id, owner_id, project_id, name, widgets, created_at, updated_at';

/** Stored widgets that no longer parse (a type since retired) are left out, not fatal. */
const toDashboard = (row: DashboardRow): Dashboard => ({
  id: row.id,
  ownerId: row.owner_id,
  projectId: row.project_id,
  name: row.name,
  widgets: (Array.isArray(row.widgets) ? row.widgets : []).flatMap((widget) => {
    const parsed = dashboardWidgetSchema.safeParse(widget);
    return parsed.success ? [parsed.data] : [];
  }),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

/** Gives each new widget an id and refuses a list that names one id twice. */
function withIds(widgets: readonly DashboardWidgetInput[]): DashboardWidget[] {
  const seen = new Set<string>();
  return widgets.map((widget) => {
    const id = widget.id ?? randomUUID();
    if (seen.has(id)) throw new ValidationError('Each widget on a dashboard needs its own id');
    seen.add(id);
    return dashboardWidgetSchema.parse({ ...widget, id });
  });
}

const personOf = (ctx: RequestContext): string => {
  const userId = actorUserId(ctx);
  if (!userId) throw new ForbiddenError('Dashboards belong to a person');
  return userId;
};

/** Report dashboards: one person's widget grids over a project they can read. */
export function createDashboardsService(deps: Pick<PlanningDeps, 'database'>) {
  async function projectFor(ctx: RequestContext, sql: SqlExecutor, ref: string) {
    const project = await resolveProject(sql, ref);
    await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(project.id));
    return project;
  }

  /** The caller's own dashboard, with their read access to its project checked again. */
  async function owned(ctx: RequestContext, sql: SqlExecutor, id: string) {
    const [row] = await sql<DashboardRow[]>`
      select ${sql.unsafe(COLUMNS)} from dashboards
      where id = ${id} and owner_id = ${personOf(ctx)}`;
    if (!row) throw new NotFoundError('The dashboard was not found');
    await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(row.project_id));
    return row;
  }

  async function write(sql: SqlExecutor, id: string, name: string, widgets: DashboardWidget[]) {
    const [row] = await sql<DashboardRow[]>`
      update dashboards set name = ${name}, widgets = ${JSON.stringify(widgets)}::jsonb, updated_at = now()
      where id = ${id}
      returning ${sql.unsafe(COLUMNS)}`;
    return toDashboard(row as DashboardRow);
  }

  return {
    async list(ctx: RequestContext, query: ListDashboardsQuery): Promise<Dashboard[]> {
      const sql = requireDatabase(deps);
      const project = await projectFor(ctx, sql, query.projectId);
      const rows = await sql<DashboardRow[]>`
        select ${sql.unsafe(COLUMNS)} from dashboards
        where owner_id = ${personOf(ctx)} and project_id = ${project.id}
        order by created_at, id`;
      return rows.map(toDashboard);
    },

    async get(ctx: RequestContext, id: string): Promise<Dashboard> {
      return toDashboard(await owned(ctx, requireDatabase(deps), id));
    },

    async create(ctx: RequestContext, body: CreateDashboardBody): Promise<Dashboard> {
      const sql = requireDatabase(deps);
      const userId = personOf(ctx);
      const project = await projectFor(ctx, sql, body.projectId);
      const widgets = withIds(body.widgets ?? defaultDashboardWidgets(project.method));
      const [row] = await sql<DashboardRow[]>`
        insert into dashboards (owner_id, project_id, name, widgets)
        values (${userId}, ${project.id}, ${body.name.trim()}, ${JSON.stringify(widgets)}::jsonb)
        returning ${sql.unsafe(COLUMNS)}`;
      return toDashboard(row as DashboardRow);
    },

    async update(ctx: RequestContext, id: string, body: UpdateDashboardBody): Promise<Dashboard> {
      const sql = requireDatabase(deps);
      const current = toDashboard(await owned(ctx, sql, id));
      const widgets = body.widgets ? withIds(body.widgets) : current.widgets;
      return write(sql, id, body.name?.trim() ?? current.name, widgets);
    },

    /** Adds one widget: how a report saved elsewhere is pinned to a dashboard. */
    async addWidget(ctx: RequestContext, id: string, body: AddDashboardWidgetBody) {
      const sql = requireDatabase(deps);
      const current = toDashboard(await owned(ctx, sql, id));
      if (current.widgets.length >= MAX_DASHBOARD_WIDGETS) {
        throw new ValidationError(`A dashboard holds at most ${MAX_DASHBOARD_WIDGETS} widgets`);
      }
      const [widget] = withIds([{ ...body.widget, id: undefined }]);
      const widgets = [...current.widgets];
      widgets.splice(body.position ?? widgets.length, 0, widget as DashboardWidget);
      return write(sql, id, current.name, widgets);
    },

    async removeWidget(ctx: RequestContext, id: string, widgetId: string): Promise<void> {
      const sql = requireDatabase(deps);
      const current = toDashboard(await owned(ctx, sql, id));
      const widgets = current.widgets.filter((widget) => widget.id !== widgetId);
      if (widgets.length === current.widgets.length) {
        throw new NotFoundError('The widget was not found on this dashboard');
      }
      await write(sql, id, current.name, widgets);
    },

    async remove(ctx: RequestContext, id: string): Promise<void> {
      const sql = requireDatabase(deps);
      await owned(ctx, sql, id);
      await sql`delete from dashboards where id = ${id}`;
    },
  };
}

export type DashboardsService = ReturnType<typeof createDashboardsService>;

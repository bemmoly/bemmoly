import { listSchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { nameSchema } from './common.ts';
import type { WorkMethod } from './enums.ts';
import { quarterRefSchema } from './quarter.ts';
import { scopeKindSchema } from './reports.ts';

/*
 * A dashboard is one person's grid of report widgets over a project. Each widget names a type
 * from the registry below and carries that type's config; the grid order is the array order.
 * A new report type is one entry in WIDGET_CONFIGS (and a renderer in the web registry).
 */

export const MAX_DASHBOARD_WIDGETS = 24;

/** Half a row or the full row of the two-column grid. */
export const widgetSizeSchema = z.enum(['half', 'full']);

const sprintConfig = z.object({
  /** The sprint drawn; the active one, else the latest started, when absent. */
  sprintId: z.uuid().optional(),
});
const flowConfig = z.object({ days: z.union([z.literal(14), z.literal(30), z.literal(90)]) });
const cycleConfig = z.object({ days: z.number().int().min(7).max(365) });
const scopeConfig = z.object({ kind: scopeKindSchema, id: z.uuid().optional() });
const quarterConfig = z.object({
  /** "2026-Q4"; the current quarter when absent, so the widget rolls over by itself. */
  quarter: quarterRefSchema.optional(),
});

/**
 * A report saved from elsewhere (the assistant, today) and pinned to a dashboard. Bemmoly
 * stores it as given; `kind` picks the renderer on the web, which draws a plain note for a
 * kind it does not know, so a newer producer never breaks an older dashboard.
 */
export const pinnedReportSpecSchema = z
  .object({
    version: z.literal(1),
    title: nameSchema,
    description: z.string().trim().max(500).optional(),
    kind: z.string().regex(/^[a-z][a-z0-9.-]{0,62}$/),
    /** Who produced it, e.g. "assistant". */
    source: z.string().trim().min(1).max(40).default('assistant'),
    params: z.record(z.string(), z.unknown()).default({}),
  })
  .refine((spec) => JSON.stringify(spec.params).length <= 16_000, {
    message: 'A pinned report holds at most 16 KB of parameters',
    path: ['params'],
  });
const pinnedConfig = z.object({ spec: pinnedReportSpecSchema });

/** The widget registry: each type, its config and how it sits on the grid by default. */
export const WIDGET_CONFIGS = {
  burndown: { config: sprintConfig, size: 'half', label: 'Burndown' },
  burnup: { config: sprintConfig, size: 'half', label: 'Burnup' },
  velocity: { config: z.object({}), size: 'half', label: 'Velocity' },
  'cumulative-flow': { config: flowConfig, size: 'half', label: 'Cumulative flow' },
  'created-resolved': { config: flowConfig, size: 'half', label: 'Created vs resolved' },
  'control-chart': { config: cycleConfig, size: 'half', label: 'Control chart' },
  'time-in-status': { config: cycleConfig, size: 'half', label: 'Time in status' },
  'scope-burnup': { config: scopeConfig, size: 'half', label: 'Epic or version burnup' },
  quarter: { config: quarterConfig, size: 'full', label: 'Quarter' },
  pinned: { config: pinnedConfig, size: 'half', label: 'Pinned report' },
} as const satisfies Record<
  string,
  { config: z.ZodObject; size: z.infer<typeof widgetSizeSchema>; label: string }
>;

export type WidgetType = keyof typeof WIDGET_CONFIGS;
export const WIDGET_TYPES = Object.keys(WIDGET_CONFIGS) as WidgetType[];

/** The config a new widget of each built-in type starts with. */
export const WIDGET_DEFAULT_CONFIGS: { [T in Exclude<WidgetType, 'pinned'>]: WidgetConfig<T> } = {
  burndown: {},
  burnup: {},
  velocity: {},
  'cumulative-flow': { days: 30 },
  'created-resolved': { days: 30 },
  'control-chart': { days: 90 },
  'time-in-status': { days: 90 },
  'scope-burnup': { kind: 'epic' },
  quarter: {},
};

const widgetOf = <T extends WidgetType, I extends z.ZodType>(type: T, id: I) =>
  z.object({
    id,
    type: z.literal(type),
    size: widgetSizeSchema,
    config: WIDGET_CONFIGS[type].config as (typeof WIDGET_CONFIGS)[T]['config'],
  });

/** One variant per registry entry; a new type adds its line here too. */
const variants = <I extends z.ZodType>(id: I) =>
  [
    widgetOf('burndown', id),
    widgetOf('burnup', id),
    widgetOf('velocity', id),
    widgetOf('cumulative-flow', id),
    widgetOf('created-resolved', id),
    widgetOf('control-chart', id),
    widgetOf('time-in-status', id),
    widgetOf('scope-burnup', id),
    widgetOf('quarter', id),
    widgetOf('pinned', id),
  ] as const;

export const dashboardWidgetSchema = z.discriminatedUnion('type', variants(z.uuid()));

/** A widget as a client sends it: the server assigns the id of a new one. */
export const dashboardWidgetInputSchema = z.discriminatedUnion(
  'type',
  variants(z.uuid().optional()),
);

const widgetListSchema = z
  .array(dashboardWidgetInputSchema)
  .max(MAX_DASHBOARD_WIDGETS, `A dashboard holds at most ${MAX_DASHBOARD_WIDGETS} widgets`);

export const dashboardSchema = z.object({
  id: z.uuid(),
  ownerId: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  widgets: z.array(dashboardWidgetSchema),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const dashboardsResponseSchema = listSchema(dashboardSchema);

export const listDashboardsQuerySchema = z.object({
  /** The project's key or id. */
  projectId: z.string().trim().min(1).max(64),
});

export const createDashboardBodySchema = z.object({
  name: nameSchema,
  projectId: z.string().trim().min(1).max(64),
  /** The starting widgets; the project's default set when absent. */
  widgets: widgetListSchema.optional(),
});

/** Renames the dashboard or replaces its layout: order, sizes, configs, removals. */
export const updateDashboardBodySchema = z
  .object({ name: nameSchema, widgets: widgetListSchema })
  .partial();

/** `POST /dashboards/:id/widgets`: one widget added, at the end unless a position is given. */
export const addDashboardWidgetBodySchema = z.object({
  widget: dashboardWidgetInputSchema,
  position: z.number().int().min(0).max(MAX_DASHBOARD_WIDGETS).optional(),
});

export const dashboardWidgetParamsSchema = z.object({ id: z.uuid(), widgetId: z.uuid() });

export type WidgetSize = z.infer<typeof widgetSizeSchema>;
export type WidgetConfig<T extends WidgetType> = z.infer<(typeof WIDGET_CONFIGS)[T]['config']>;
export type PinnedReportSpec = z.infer<typeof pinnedReportSpecSchema>;
export type DashboardWidget = z.infer<typeof dashboardWidgetSchema>;
export type DashboardWidgetInput = z.input<typeof dashboardWidgetInputSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type ListDashboardsQuery = z.infer<typeof listDashboardsQuerySchema>;
export type CreateDashboardBody = z.input<typeof createDashboardBodySchema>;
export type UpdateDashboardBody = z.input<typeof updateDashboardBodySchema>;
export type AddDashboardWidgetBody = z.input<typeof addDashboardWidgetBodySchema>;

/** A new widget of a built-in type at its default size and config. */
export function newWidget(type: Exclude<WidgetType, 'pinned'>): DashboardWidgetInput {
  return {
    type,
    size: WIDGET_CONFIGS[type].size,
    config: WIDGET_DEFAULT_CONFIGS[type],
  } as DashboardWidgetInput;
}

/**
 * What a new dashboard starts with: a scrum project gets the sprint reports first, a kanban
 * one the flow reports; both end with the quarter.
 */
export function defaultDashboardWidgets(method: WorkMethod): DashboardWidgetInput[] {
  const types: Exclude<WidgetType, 'pinned'>[] =
    method === 'scrum'
      ? ['burndown', 'burnup', 'velocity', 'cumulative-flow', 'quarter']
      : ['cumulative-flow', 'created-resolved', 'control-chart', 'time-in-status', 'quarter'];
  return types.map(newWidget);
}

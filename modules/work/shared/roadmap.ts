import { timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { issueKeySchema } from './common.ts';
import { statusCategorySchema, versionStatusSchema, workMethodSchema } from './enums.ts';
import { projectKeySchema } from './projects.ts';

/*
 * The roadmap: epics and unreleased versions on a timeline, across the projects a person can
 * open, each with a forecast of when it lands. The forecast is arithmetic over the project's
 * own history (tech design §14, "Sprints and metrics"), computed on the server; nothing here
 * is AI output.
 */

export const ROADMAP_ZOOMS = ['weeks', 'months', 'quarters'] as const;
export const roadmapZoomSchema = z.enum(ROADMAP_ZOOMS);

export const ROADMAP_GROUPS = ['project', 'team', 'none'] as const;
export const roadmapGroupSchema = z.enum(ROADMAP_GROUPS);

/** Points per sprint when the project runs sprints with estimates, else issues per week. */
export const forecastBasisSchema = z.enum(['velocity', 'throughput']);

export const FORECAST_STATES = [
  'done',
  'on_track',
  'at_risk',
  'late',
  'no_target',
  'no_forecast',
  'no_work',
] as const;
export const forecastStateSchema = z.enum(FORECAST_STATES);

export const forecastConfidenceSchema = z.enum(['high', 'medium', 'low']);

/** What a project's forecasts are drawn from: one sample per finished period, oldest first. */
export const forecastHistorySchema = z.object({
  basis: forecastBasisSchema,
  unit: z.enum(['issues', 'points']),
  samples: z.array(z.number().nonnegative()),
  /** Seven for weeks; the mean length of the sprints for velocity. */
  periodDays: z.number().positive(),
});

export const forecastSchema = z.object({
  state: forecastStateSchema,
  basis: forecastBasisSchema.nullable(),
  remainingIssues: z.number().int().nonnegative(),
  /** Estimated points left, unestimated issues counted at the project's mean; velocity only. */
  remainingPoints: z.number().nonnegative().nullable(),
  /** Half of the simulated futures finish by this day. */
  likely: z.iso.date().nullable(),
  /** 15 in 100 finish by `earliest`, 85 in 100 by `latest`. */
  earliest: z.iso.date().nullable(),
  latest: z.iso.date().nullable(),
  confidence: forecastConfidenceSchema.nullable(),
  /** The likely day minus the target, in days; above zero is late. */
  daysLate: z.number().int().nullable(),
  /** Items this one cannot finish before. */
  waitsOn: z.array(z.uuid()),
  /** The forecast in plain words, one sentence each. */
  explanation: z.array(z.string()),
});

export const roadmapProgressSchema = z.object({
  total: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  inProgress: z.number().int().nonnegative(),
  points: z.number().nonnegative(),
  pointsDone: z.number().nonnegative(),
});

/** An issue under an epic, drawn as a thin bar when it has dates. */
export const roadmapChildSchema = z.object({
  id: z.uuid(),
  key: issueKeySchema,
  title: z.string(),
  typeId: z.uuid(),
  statusName: z.string(),
  statusCategory: statusCategorySchema,
  assigneeId: z.uuid().nullable(),
  estimate: z.number().nonnegative().nullable(),
  startAt: z.iso.date().nullable(),
  dueAt: z.iso.date().nullable(),
});

export const roadmapItemSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['epic', 'version']),
  projectId: z.uuid(),
  /** The epic's key; versions have none. */
  key: issueKeySchema.nullable(),
  title: z.string(),
  /** The epic's palette colour ('epic-1' … 'epic-8'); null for versions. */
  color: z.string().nullable(),
  statusCategory: statusCategorySchema.nullable(),
  versionStatus: versionStatusSchema.nullable(),
  /** Stored dates: the start, and the due or release date. */
  startAt: z.iso.date().nullable(),
  endAt: z.iso.date().nullable(),
  /** Where the bar is drawn: the stored dates, or what the work itself shows. */
  start: z.iso.date().nullable(),
  end: z.iso.date().nullable(),
  progress: roadmapProgressSchema,
  /** People with open work in it, most work first. */
  assigneeIds: z.array(z.uuid()).max(5),
  /** Whether the person may move its dates. */
  canSchedule: z.boolean(),
  forecast: forecastSchema,
  children: z.array(roadmapChildSchema),
});

/** `fromId` blocks `toId`: an epic-level "blocks" link. */
export const roadmapDependencySchema = z.object({
  id: z.uuid(),
  fromId: z.uuid(),
  toId: z.uuid(),
});

export const roadmapProjectSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  name: z.string(),
  teamId: z.uuid().nullable(),
  method: workMethodSchema,
  history: forecastHistorySchema.nullable(),
});

export const roadmapViewSchema = z.object({
  /** The server's today, which every forecast counts from. */
  today: z.iso.date(),
  projects: z.array(roadmapProjectSchema),
  teams: z.array(z.object({ id: z.uuid(), name: z.string() })),
  items: z.array(roadmapItemSchema),
  dependencies: z.array(roadmapDependencySchema),
  computedAt: timestampSchema,
});

/** "PLT,SUP" in a query string. */
const projectKeysSchema = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean),
  )
  .pipe(z.array(projectKeySchema).min(1).max(50));

export const roadmapQuerySchema = z.object({
  /** Project keys, comma separated; every project the person can open when left out. */
  projects: projectKeysSchema.optional(),
  teamId: z.uuid().optional(),
});

export type RoadmapZoom = z.infer<typeof roadmapZoomSchema>;
export type RoadmapGroup = z.infer<typeof roadmapGroupSchema>;
export type ForecastBasis = z.infer<typeof forecastBasisSchema>;
export type ForecastState = z.infer<typeof forecastStateSchema>;
export type ForecastConfidence = z.infer<typeof forecastConfidenceSchema>;
export type ForecastHistory = z.infer<typeof forecastHistorySchema>;
export type Forecast = z.infer<typeof forecastSchema>;
export type RoadmapProgress = z.infer<typeof roadmapProgressSchema>;
export type RoadmapChild = z.infer<typeof roadmapChildSchema>;
export type RoadmapItem = z.infer<typeof roadmapItemSchema>;
export type RoadmapDependency = z.infer<typeof roadmapDependencySchema>;
export type RoadmapProject = z.infer<typeof roadmapProjectSchema>;
export type RoadmapView = z.infer<typeof roadmapViewSchema>;
export type RoadmapQuery = z.infer<typeof roadmapQuerySchema>;
export type RoadmapQueryInput = z.input<typeof roadmapQuerySchema>;

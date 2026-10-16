import { z } from 'zod';
import { domainColorSchema } from './catalog.ts';
import {
  glyphStateSchema,
  idSchema,
  isoDateTimeSchema,
  scopePathSchema,
  slugSchema,
} from './common.ts';
import { environmentRefSchema } from './environments.ts';

/*
 * The Release map: GET /api/v1/pipelines/map?scope=commerce&at=2026-10-16T14:05Z. Rows are
 * domains at the organisation, groups inside a domain and applications inside a group;
 * columns are "Build and test" and then each environment. Cells carry counts, and dots only
 * for releases that are moving, so the map stays smooth with 1,140 applications. `at`
 * rewinds to that moment from the deployment events.
 */

export const mapQuerySchema = z.object({
  scope: scopePathSchema.optional(),
  /** Absent means live. */
  at: isoDateTimeSchema.optional(),
  team: idSchema.optional(),
  tier: z.coerce.number().int().min(0).max(2).optional(),
});

export const mapColumnSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('build'), key: z.literal('build'), label: z.string() }),
  z.object({
    kind: z.literal('environment'),
    key: slugSchema,
    label: z.string(),
    environment: environmentRefSchema,
    protected: z.boolean(),
  }),
]);

/** A release moving through a cell, drawn as a dot travelling along the lane. */
export const mapDotSchema = z.object({
  id: idSchema,
  application: slugSchema,
  version: z.string(),
  state: glyphStateSchema,
  /** How far along the lane, 0 to 1 (canary traffic, or elapsed over expected time). */
  progress: z.number().min(0).max(1),
});

export const mapCellSchema = z.object({
  column: z.string(),
  /** Applications with a release here, or running builds in the build column. */
  total: z.number().int(),
  moving: z.number().int(),
  failed: z.number().int(),
  waiting: z.number().int(),
  canary: z.number().int(),
  rolledBack: z.number().int(),
  /** Build column only: runs in progress. */
  running: z.number().int(),
  /** "train 11:00", "rolled back 09:12": one short note when something needs saying. */
  note: z.string().nullable(),
  dots: z.array(mapDotSchema).max(12),
});

export const mapRowSchema = z.object({
  kind: z.enum(['domain', 'group', 'application']),
  id: idSchema,
  key: slugSchema,
  name: z.string(),
  /** Domains only; groups and applications draw no tile. */
  color: domainColorSchema.nullable(),
  /** Applications in this row. */
  count: z.number().int(),
  /** The scope path a click zooms to; null for an application row (it opens instead). */
  zoomTo: z.string().nullable(),
  cells: z.array(mapCellSchema),
});

export const timelineBucketSchema = z.object({
  start: isoDateTimeSchema,
  deploys: z.number().int(),
  incident: z.boolean(),
});

export const mapSchema = z.object({
  scope: z.object({ path: z.string(), name: z.string() }),
  at: isoDateTimeSchema.nullable(),
  live: z.boolean(),
  columns: z.array(mapColumnSchema),
  rows: z.array(mapRowSchema),
  /** Deploys per 15 minutes over the last 24 hours, oldest first, with incident ticks. */
  timeline: z.array(timelineBucketSchema),
  totals: z.object({ applications: z.number().int(), domains: z.number().int() }),
});

export type MapQuery = z.infer<typeof mapQuerySchema>;
export type MapColumn = z.infer<typeof mapColumnSchema>;
export type MapDot = z.infer<typeof mapDotSchema>;
export type MapCell = z.infer<typeof mapCellSchema>;
export type MapRow = z.infer<typeof mapRowSchema>;
export type TimelineBucket = z.infer<typeof timelineBucketSchema>;
export type ReleaseMap = z.infer<typeof mapSchema>;

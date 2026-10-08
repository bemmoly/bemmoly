import { hexColorSchema, listSchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { nameSchema, shortNameSchema } from './common.ts';
import { boardLaneKindSchema, cardColorRuleSchema, estimationUnitSchema } from './enums.ts';

/*
 * One JSON config per board, in the shape of the Board Settings mock's tabs:
 * columns, swimlanes, cards, method and estimation. The org default board
 * scheme is the board with no project.
 */

export const boardColumnSchema = z.object({
  id: z.string().min(1),
  name: shortNameSchema,
  statusIds: z.array(z.uuid()).max(50),
  wipLimit: z.number().int().positive().nullable().default(null),
  /** The column that completes an issue for flow metrics. */
  done: z.boolean().default(false),
});

/** The card fields of the Board Settings mock, in its order. */
export const CARD_FIELDS = [
  'type',
  'key',
  'priority',
  'labels',
  'estimate',
  'assignee',
  'docs',
  'blocked',
  'due',
  'subtasks',
  'reporter',
  'created',
] as const;

export const cardFieldSchema = z.enum(CARD_FIELDS);

export const boardLanesSchema = z.object({
  kind: boardLaneKindSchema.default('none'),
  /** Named LQL lanes, used when kind is "query". */
  queries: z
    .array(z.object({ name: shortNameSchema, query: z.string().trim().min(1).max(4000) }))
    .max(20)
    .default([]),
  showEmpty: z.boolean().default(false),
  collapsible: z.boolean().default(true),
  totals: z.boolean().default(true),
});

export const WORKING_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export const boardConfigSchema = z.object({
  columns: z.array(boardColumnSchema).min(2).max(20),
  collapseEmptyColumns: z.boolean().default(true),
  showColumnCounts: z.boolean().default(true),
  showUnassigned: z.boolean().default(false),
  lanes: boardLanesSchema.prefault({}),
  cardFields: z
    .array(cardFieldSchema)
    .default(['type', 'key', 'priority', 'labels', 'estimate', 'assignee']),
  colorRule: cardColorRuleSchema.default('none'),
  estimationUnit: estimationUnitSchema.default('points'),
  /** Sprint length in days for Scrum boards. */
  cadenceDays: z.number().int().min(1).max(60).default(14),
  workingDays: z.array(z.enum(WORKING_DAYS)).min(1).default(['mon', 'tue', 'wed', 'thu', 'fri']),
  /** Named quick filters shown above the board. */
  quickFilters: z
    .array(z.object({ name: shortNameSchema, query: z.string().trim().min(1).max(4000) }))
    .max(20)
    .default([]),
  colors: z.record(z.string(), hexColorSchema).default({}),
});

export const boardSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid().nullable(),
  originId: z.uuid().nullable(),
  name: z.string(),
  config: boardConfigSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createBoardBodySchema = z.object({
  name: nameSchema,
  config: boardConfigSchema.optional(),
});

export const updateBoardBodySchema = z
  .object({ name: nameSchema, config: boardConfigSchema })
  .partial();

/** Everything the Board screen paints, in one call. */
export const boardCardSchema = z.object({
  issueId: z.uuid(),
  key: z.string(),
  title: z.string(),
  typeId: z.uuid(),
  statusId: z.uuid(),
  priority: z.string(),
  assigneeId: z.uuid().nullable(),
  estimate: z.number().nullable(),
  labelIds: z.array(z.uuid()),
  rank: z.string(),
  blockedBy: z.array(z.string()),
  dueAt: z.iso.date().nullable(),
  subtasks: z.object({ done: z.number().int(), total: z.number().int() }).nullable(),
  parentId: z.uuid().nullable(),
  /** Short names of linked docs ("RFC", "Spec"); the card shows the first. */
  docs: z.array(z.string()).default([]),
  /** Days since the status last changed. */
  ageDays: z.number().int().nonnegative(),
});

export const boardViewSchema = z.object({
  board: boardSchema,
  sprintId: z.uuid().nullable(),
  columns: z.array(
    z.object({
      id: z.string(),
      count: z.number().int().nonnegative(),
      wipLimit: z.number().int().nullable(),
      overWip: z.boolean(),
    }),
  ),
  lanes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      /** A palette name the screens map to a colour (ac, violet, tx6), or null for none. */
      color: z.string().nullable(),
      /** The epic's key and due date when the lane is an epic; the lane header shows both. */
      issueKey: z.string().nullable().default(null),
      dueAt: z.iso.date().nullable().default(null),
    }),
  ),
  cards: z.array(boardCardSchema.extend({ columnId: z.string(), laneId: z.string() })),
  metrics: z.object({
    throughputPerWeek: z.number().nonnegative(),
    cycleTimeDays: z.number().nonnegative().nullable(),
    wipCount: z.number().int().nonnegative(),
    /** Sprint points on the board and the points in done columns; the Velocity tile. */
    committedPoints: z.number().nonnegative().default(0),
    completedPoints: z.number().nonnegative().default(0),
    /** Issues completed per week, oldest first; the Flow tile's sparkline. */
    throughputHistory: z.array(z.number().nonnegative()).default([]),
  }),
});

export const boardViewQuerySchema = z.object({
  sprintId: z.uuid().optional(),
  /** An LQL quick filter applied on top of the board's own scope. */
  q: z.string().trim().max(4000).optional(),
});

export const boardsResponseSchema = listSchema(boardSchema);

export type BoardColumn = z.input<typeof boardColumnSchema>;
export type CardField = z.infer<typeof cardFieldSchema>;
export type BoardLanes = z.input<typeof boardLanesSchema>;
export type BoardConfig = z.infer<typeof boardConfigSchema>;
export type BoardConfigInput = z.input<typeof boardConfigSchema>;
export type Board = z.infer<typeof boardSchema>;
export type CreateBoardBody = z.input<typeof createBoardBodySchema>;
export type UpdateBoardBody = z.input<typeof updateBoardBodySchema>;
export type BoardCard = z.infer<typeof boardCardSchema>;
export type BoardView = z.infer<typeof boardViewSchema>;
export type BoardViewQuery = z.infer<typeof boardViewQuerySchema>;

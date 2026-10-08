import { listSchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { nameSchema } from './common.ts';
import { sprintStateSchema } from './enums.ts';

/** Written once when a sprint closes; the velocity report reads it, never the issues. */
export const sprintSnapshotSchema = z.object({
  committedPoints: z.number().nonnegative(),
  completedPoints: z.number().nonnegative(),
  committedIssues: z.number().int().nonnegative(),
  completedIssues: z.number().int().nonnegative(),
  /** Where unfinished work went: the next sprint's id or the backlog. */
  carriedOverTo: z.uuid().nullable(),
});

export const sprintSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  goal: z.string().nullable(),
  startsAt: timestampSchema.nullable(),
  endsAt: timestampSchema.nullable(),
  state: sprintStateSchema,
  capacityPoints: z.number().nonnegative().nullable(),
  completedSnapshot: sprintSnapshotSchema.nullable(),
  startedAt: timestampSchema.nullable(),
  closedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

interface SprintDates {
  startsAt: string | null;
  endsAt: string | null;
}

const endsAfterStart = (dates: SprintDates) =>
  !dates.startsAt || !dates.endsAt || dates.endsAt > dates.startsAt;

export const createSprintBodySchema = z
  .object({
    name: nameSchema,
    goal: z.string().trim().max(1000).optional(),
    startsAt: timestampSchema.nullable().default(null),
    endsAt: timestampSchema.nullable().default(null),
    capacityPoints: z.number().nonnegative().max(100_000).optional(),
  })
  .refine(endsAfterStart, { message: 'A sprint ends after it starts', path: ['endsAt'] });

export const updateSprintBodySchema = z
  .object({
    name: nameSchema,
    goal: z.string().trim().max(1000).nullable(),
    startsAt: timestampSchema.nullable(),
    endsAt: timestampSchema.nullable(),
    capacityPoints: z.number().nonnegative().max(100_000).nullable(),
  })
  .partial();

/** Starting needs dates; the body may supply the ones the sprint lacks. */
export const startSprintBodySchema = z
  .object({
    startsAt: timestampSchema.optional(),
    endsAt: timestampSchema.optional(),
  })
  .refine(
    (dates) => endsAfterStart({ startsAt: dates.startsAt ?? null, endsAt: dates.endsAt ?? null }),
    {
      message: 'A sprint ends after it starts',
      path: ['endsAt'],
    },
  );

/** Where unfinished issues go when the sprint closes. */
export const completeSprintBodySchema = z.object({
  moveUnfinishedTo: z.union([z.literal('backlog'), z.literal('next'), z.uuid()]).default('backlog'),
});

export const listSprintsQuerySchema = z.object({
  state: sprintStateSchema.optional(),
});

export const sprintReportSchema = z.object({
  sprint: sprintSchema,
  burndown: z.array(z.object({ date: z.iso.date(), remainingPoints: z.number().nonnegative() })),
  velocity: z.array(
    z.object({ sprintId: z.uuid(), name: z.string(), completedPoints: z.number().nonnegative() }),
  ),
});

export const sprintsResponseSchema = listSchema(sprintSchema);

export type SprintSnapshot = z.infer<typeof sprintSnapshotSchema>;
export type Sprint = z.infer<typeof sprintSchema>;
export type CreateSprintBody = z.input<typeof createSprintBodySchema>;
export type UpdateSprintBody = z.infer<typeof updateSprintBodySchema>;
export type StartSprintBody = z.infer<typeof startSprintBodySchema>;
export type CompleteSprintBody = z.input<typeof completeSprintBodySchema>;
export type ListSprintsQuery = z.infer<typeof listSprintsQuerySchema>;
export type SprintReport = z.infer<typeof sprintReportSchema>;

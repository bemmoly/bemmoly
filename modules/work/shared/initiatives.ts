import { keysetPageSchema, keysetQuerySchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { nameSchema, queryFlagSchema } from './common.ts';
import { namePrefixSchema } from './links-labels.ts';
import { roadmapProgressSchema } from './roadmap.ts';

/*
 * An initiative: a program of work one level above epics. It gathers epics from any number of
 * projects and teams, so one view can show them on one timeline with their progress,
 * dependencies and forecasts. It belongs to the workspace, not to a project; what it shows of
 * each epic follows the projects the person can open.
 */

const descriptionSchema = z.string().trim().max(2000);

/** Progress over the epics a person can see; epics in projects they cannot open are `hidden`. */
export const initiativeEpicCountsSchema = z.object({
  total: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  hidden: z.number().int().nonnegative(),
});

export const initiativeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  ownerId: z.uuid().nullable(),
  startAt: z.iso.date().nullable(),
  targetAt: z.iso.date().nullable(),
  archivedAt: timestampSchema.nullable(),
  createdBy: z.uuid().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  epics: initiativeEpicCountsSchema,
  /** The issues under its visible epics, summed. */
  progress: roadmapProgressSchema,
  /** The projects its visible epics belong to. */
  projectIds: z.array(z.uuid()),
  /** Whether the person may edit it, archive it and link epics to it. */
  canManage: z.boolean(),
});

const datesInOrder = (body: { startAt?: string | null; targetAt?: string | null }) =>
  !body.startAt || !body.targetAt || body.startAt <= body.targetAt;

const ORDER_MESSAGE = {
  message: 'An initiative starts on or before its target date',
  path: ['startAt'],
};

export const createInitiativeBodySchema = z
  .object({
    name: nameSchema,
    description: descriptionSchema.nullable().optional(),
    ownerId: z.uuid().nullable().optional(),
    startAt: z.iso.date().nullable().optional(),
    targetAt: z.iso.date().nullable().optional(),
    /** Epics to link at once, as the create dialog picks them. */
    epicIds: z.array(z.uuid()).max(200).optional(),
  })
  .strict()
  .refine(datesInOrder, ORDER_MESSAGE);

export const updateInitiativeBodySchema = z
  .object({
    name: nameSchema,
    description: descriptionSchema.nullable(),
    ownerId: z.uuid().nullable(),
    startAt: z.iso.date().nullable(),
    targetAt: z.iso.date().nullable(),
  })
  .partial()
  .strict()
  .refine(datesInOrder, ORDER_MESSAGE);

export const linkInitiativeEpicBodySchema = z.object({ epicId: z.uuid() }).strict();

/** Initiatives page by name, then id; archived ones only when asked for. */
export const listInitiativesQuerySchema = keysetQuerySchema.extend({
  q: namePrefixSchema.optional(),
  archived: queryFlagSchema.default(false),
});

export const initiativesPageSchema = keysetPageSchema(initiativeSchema);

export type InitiativeEpicCounts = z.infer<typeof initiativeEpicCountsSchema>;
export type Initiative = z.infer<typeof initiativeSchema>;
export type CreateInitiativeBody = z.input<typeof createInitiativeBodySchema>;
export type UpdateInitiativeBody = z.input<typeof updateInitiativeBodySchema>;
export type LinkInitiativeEpicBody = z.infer<typeof linkInitiativeEpicBodySchema>;
export type ListInitiativesQuery = z.infer<typeof listInitiativesQuerySchema>;
export type ListInitiativesQueryInput = z.input<typeof listInitiativesQuerySchema>;
export type InitiativesPage = z.infer<typeof initiativesPageSchema>;

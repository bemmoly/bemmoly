import { z } from 'zod';
import { dateSchema, nameSchema, queryFlagSchema } from './common.ts';

/*
 * Onboarding and offboarding journeys: a template per role or location lists tasks with an
 * owner rule and a day offset; starting one fans the tasks out to real owners with due dates.
 * The kernel's person.joined and person.leaving events start them.
 */

export const JOURNEY_KINDS = ['onboarding', 'offboarding'] as const;
export const journeyKindSchema = z.enum(JOURNEY_KINDS);
export type JourneyKind = z.infer<typeof journeyKindSchema>;

/** Who does a task: the person, their manager, or a named colleague (IT, People). */
export const taskOwnerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('person') }),
  z.object({ type: z.literal('manager') }),
  z.object({ type: z.literal('user'), userId: z.uuid() }),
]);
export type TaskOwner = z.infer<typeof taskOwnerSchema>;

export const templateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  owner: taskOwnerSchema,
  /** Days from the start date (onboarding) or the last day (offboarding); negative is before. */
  offsetDays: z.number().int().min(-120).max(365),
});
export type TemplateTask = z.infer<typeof templateTaskSchema>;

export const journeyTemplateSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: journeyKindSchema,
  /** Null matches any location. */
  locationId: z.uuid().nullable(),
  /** Null matches any job title; otherwise the title must contain it, ignoring case. */
  jobTitle: z.string().nullable(),
  tasks: z.array(templateTaskSchema),
  archived: z.boolean(),
});

export const createJourneyTemplateBodySchema = z.object({
  name: nameSchema,
  kind: journeyKindSchema,
  locationId: z.uuid().nullish(),
  jobTitle: z.string().trim().min(1).max(120).nullish(),
  tasks: z.array(templateTaskSchema).min(1).max(100),
});

export const updateJourneyTemplateBodySchema = z.object({
  name: nameSchema.optional(),
  locationId: z.uuid().nullish(),
  jobTitle: z.string().trim().min(1).max(120).nullish(),
  tasks: z.array(templateTaskSchema).min(1).max(100).optional(),
  archived: z.boolean().optional(),
});

export const journeyTemplatesResponseSchema = z.object({ items: z.array(journeyTemplateSchema) });

export const journeyTaskSchema = z.object({
  id: z.uuid(),
  journeyId: z.uuid(),
  title: z.string(),
  ownerId: z.uuid().nullable(),
  dueDate: dateSchema,
  doneAt: z.string().nullable(),
  doneBy: z.uuid().nullable(),
});

export const JOURNEY_STATES = ['open', 'done', 'cancelled'] as const;

export const journeySchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  kind: journeyKindSchema,
  templateId: z.uuid().nullable(),
  templateName: z.string(),
  /** The start date for onboarding, the last day for offboarding. */
  anchorDate: dateSchema,
  state: z.enum(JOURNEY_STATES),
  taskCount: z.number().int(),
  doneCount: z.number().int(),
  createdAt: z.string(),
});

export const journeyDetailSchema = journeySchema.extend({ tasks: z.array(journeyTaskSchema) });

export const listJourneysQuerySchema = z.object({
  kind: journeyKindSchema.optional(),
  userId: z.uuid().optional(),
  open: queryFlagSchema.optional(),
});

export const journeysResponseSchema = z.object({ items: z.array(journeySchema) });

export const startJourneyBodySchema = z.object({
  userId: z.uuid(),
  templateId: z.uuid(),
  anchorDate: dateSchema,
});

export const updateJourneyTaskBodySchema = z.object({
  done: z.boolean().optional(),
  ownerId: z.uuid().optional(),
});

/** Tasks waiting on the caller across journeys, soonest due first. */
export const myTaskSchema = journeyTaskSchema.extend({
  journeyUserId: z.uuid(),
  kind: journeyKindSchema,
});
export const myTasksResponseSchema = z.object({ items: z.array(myTaskSchema) });

export type JourneyTemplate = z.infer<typeof journeyTemplateSchema>;
export type CreateJourneyTemplateBody = z.input<typeof createJourneyTemplateBodySchema>;
export type UpdateJourneyTemplateBody = z.input<typeof updateJourneyTemplateBodySchema>;
export type JourneyTask = z.infer<typeof journeyTaskSchema>;
export type Journey = z.infer<typeof journeySchema>;
export type JourneyDetail = z.infer<typeof journeyDetailSchema>;
export type ListJourneysQuery = z.input<typeof listJourneysQuerySchema>;
export type StartJourneyBody = z.input<typeof startJourneyBodySchema>;
export type UpdateJourneyTaskBody = z.input<typeof updateJourneyTaskBodySchema>;
export type MyTask = z.infer<typeof myTaskSchema>;

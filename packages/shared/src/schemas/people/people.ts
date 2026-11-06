import { z } from 'zod';
import { timestampSchema } from '../contracts/common.ts';
import { keysetPageSchema, keysetQuerySchema } from '../identity/common.ts';

/*
 * The kernel's person record (ADR 0050): employment facts about a user, keyed by the user id,
 * which every product reads. Personal, pay and country fields are not here.
 */

export const EMPLOYMENT_STATES = [
  'offer_accepted',
  'active',
  'on_leave',
  'leaving',
  'left',
] as const;
export const employmentStateSchema = z.enum(EMPLOYMENT_STATES);
export type EmploymentState = z.infer<typeof employmentStateSchema>;

/**
 * Where each state may go next. `left` may start again (a rehire); `leaving` may be withdrawn.
 * Staying in the same state is always allowed and is not a transition.
 */
export const EMPLOYMENT_TRANSITIONS: Readonly<Record<EmploymentState, readonly EmploymentState[]>> =
  {
    offer_accepted: ['active', 'left'],
    active: ['on_leave', 'leaving', 'left'],
    on_leave: ['active', 'leaving', 'left'],
    leaving: ['active', 'on_leave', 'left'],
    left: ['offer_accepted', 'active'],
  };

export function canTransition(from: EmploymentState, to: EmploymentState): boolean {
  return from === to || EMPLOYMENT_TRANSITIONS[from].includes(to);
}

/** A calendar date, `YYYY-MM-DD`. */
export const calendarDateSchema = z.iso.date();

export const personSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  email: z.string(),
  state: employmentStateSchema,
  startDate: calendarDateSchema.nullable(),
  endDate: calendarDateSchema.nullable(),
  jobTitle: z.string().nullable(),
  level: z.string().nullable(),
  managerId: z.uuid().nullable(),
  teamId: z.uuid().nullable(),
  locationId: z.uuid().nullable(),
  costCentreId: z.uuid().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Person = z.infer<typeof personSchema>;

const optionalText = z.string().trim().min(1).max(120).nullish();

const recordFields = {
  state: employmentStateSchema.optional(),
  startDate: calendarDateSchema.nullish(),
  endDate: calendarDateSchema.nullish(),
  jobTitle: optionalText,
  level: z.string().trim().min(1).max(40).nullish(),
  managerId: z.uuid().nullish(),
  teamId: z.uuid().nullish(),
  locationId: z.uuid().nullish(),
  costCentreId: z.uuid().nullish(),
};

const datesInOrder = (value: { startDate?: string | null; endDate?: string | null }) =>
  !value.startDate || !value.endDate || value.startDate <= value.endDate;
const DATES_MESSAGE = { message: 'The end date is before the start date', path: ['endDate'] };

/** A record for an existing user; the state defaults to `offer_accepted`. */
export const createPersonSchema = z
  .object({ userId: z.uuid(), ...recordFields })
  .refine(datesInOrder, DATES_MESSAGE);
export type CreatePersonInput = z.infer<typeof createPersonSchema>;

/** Only the fields present change; `null` clears one. */
export const updatePersonSchema = z.object(recordFields).refine(datesInOrder, DATES_MESSAGE);
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

export const personParamsSchema = z.object({ userId: z.uuid() });

export const listPeopleQuerySchema = keysetQuerySchema.extend({
  teamId: z.uuid().optional(),
  locationId: z.uuid().optional(),
  costCentreId: z.uuid().optional(),
  managerId: z.uuid().optional(),
  state: employmentStateSchema.optional(),
});
export type ListPeopleQuery = z.infer<typeof listPeopleQuerySchema>;

export const reportsQuerySchema = z.object({
  /** Everyone below, not just direct reports. */
  all: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const peoplePageSchema = keysetPageSchema(personSchema);
export const peopleResponseSchema = z.object({ items: z.array(personSchema) });
export type PeoplePage = z.infer<typeof peoplePageSchema>;

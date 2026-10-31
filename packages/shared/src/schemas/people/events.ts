import { z } from 'zod';
import { employmentStateSchema } from './people.ts';

/** Events the kernel publishes when a person record changes (ADR 0050). */
export const PERSON_EVENT_KINDS = {
  joined: 'person.joined',
  changed: 'person.changed',
  leaving: 'person.leaving',
  left: 'person.left',
} as const;

export type PersonEventKind = (typeof PERSON_EVENT_KINDS)[keyof typeof PERSON_EVENT_KINDS];

/** The fields `person.changed` reports; state and dates have their own events. */
export const PERSON_CHANGED_FIELDS = [
  'managerId',
  'teamId',
  'locationId',
  'costCentreId',
  'jobTitle',
  'level',
] as const;
export type PersonChangedField = (typeof PERSON_CHANGED_FIELDS)[number];

const fieldValues = z.object({
  managerId: z.uuid().nullable().optional(),
  teamId: z.uuid().nullable().optional(),
  locationId: z.uuid().nullable().optional(),
  costCentreId: z.uuid().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  level: z.string().nullable().optional(),
});

export const personJoinedPayloadSchema = z.object({
  userId: z.uuid(),
  startDate: z.iso.date().nullable(),
  managerId: z.uuid().nullable(),
  teamId: z.uuid().nullable(),
  locationId: z.uuid().nullable(),
});

export const personChangedPayloadSchema = z.object({
  userId: z.uuid(),
  fields: z.array(z.enum(PERSON_CHANGED_FIELDS)).min(1),
  before: fieldValues,
  after: fieldValues,
});

export const personLeavingPayloadSchema = z.object({
  userId: z.uuid(),
  endDate: z.iso.date().nullable(),
  managerId: z.uuid().nullable(),
});

export const personLeftPayloadSchema = z.object({
  userId: z.uuid(),
  endDate: z.iso.date().nullable(),
  previousState: employmentStateSchema,
});

export type PersonJoinedPayload = z.infer<typeof personJoinedPayloadSchema>;
export type PersonChangedPayload = z.infer<typeof personChangedPayloadSchema>;
export type PersonLeavingPayload = z.infer<typeof personLeavingPayloadSchema>;
export type PersonLeftPayload = z.infer<typeof personLeftPayloadSchema>;

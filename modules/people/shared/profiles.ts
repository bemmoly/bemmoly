import { customFieldDefinitionSchema } from '@bemmoly/shared/custom-fields';
import { personSchema } from '@bemmoly/shared/people';
import { z } from 'zod';
import { dateSchema } from './common.ts';

/*
 * The directory and a person's profile: the kernel's person record, what is happening to
 * each person (joining, leaving, away), and the company's custom fields on a profile.
 */

export const HAPPENING_KINDS = ['joining', 'leaving', 'away', 'away_soon'] as const;

export const happeningSchema = z.object({
  kind: z.enum(HAPPENING_KINDS),
  /** The day it starts: the start date, the last day, the first day away. */
  date: dateSchema,
  /** The last day away, for away and away_soon. */
  until: dateSchema.nullable(),
});

export const directoryRowSchema = personSchema.extend({
  happening: happeningSchema.nullable(),
});

export const directoryQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  teamId: z.uuid().optional(),
  locationId: z.uuid().optional(),
  costCentreId: z.uuid().optional(),
  /** Without it, everyone but those who have left. */
  includeLeft: z.union([z.boolean(), z.stringbool()]).optional(),
});

export const directoryResponseSchema = z.object({ items: z.array(directoryRowSchema) });

export const profileFieldsSchema = z.object({
  /** The fields this viewer may see, in display order. */
  definitions: z.array(customFieldDefinitionSchema),
  values: z.record(z.string(), z.unknown()),
  /** Whether the viewer may write values here at all; each field's own roles still apply. */
  canEdit: z.boolean(),
});

export const profileSchema = z.object({
  person: directoryRowSchema,
  managers: z.array(personSchema),
  reports: z.array(personSchema),
  fields: profileFieldsSchema,
});

export const updateProfileFieldsBodySchema = z.object({
  values: z.record(z.string(), z.unknown()),
});

export const createProfileFieldBodySchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, 'Use lower case letters, digits and _'),
  label: z.string().trim().min(1).max(60),
  kind: z.enum(['text', 'long_text', 'number', 'date', 'select', 'boolean']),
  options: z
    .array(z.object({ value: z.string().min(1).max(60), label: z.string().min(1).max(60) }))
    .max(100)
    .default([]),
  visibleTo: z.array(z.string().min(1).max(64)).max(10).default([]),
  editableBy: z.array(z.string().min(1).max(64)).max(10).default([]),
});

export const profileFieldDefinitionsResponseSchema = z.object({
  items: z.array(customFieldDefinitionSchema),
});

export type Happening = z.infer<typeof happeningSchema>;
export type DirectoryRow = z.infer<typeof directoryRowSchema>;
export type DirectoryQuery = z.input<typeof directoryQuerySchema>;
export type ProfileFields = z.infer<typeof profileFieldsSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type UpdateProfileFieldsBody = z.input<typeof updateProfileFieldsBodySchema>;
export type CreateProfileFieldBody = z.input<typeof createProfileFieldBodySchema>;

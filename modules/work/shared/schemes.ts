import { timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';

/*
 * The override model of tech design §14: an org default scheme, a full copy
 * per project with an origin pointer, and a diff between the two that the
 * Board Settings "View diff" panel renders row by row. The status list names
 * the origin and counts what differs; dot-paths address the settings inside.
 */

export const SCHEME_KINDS = ['issue_types', 'fields', 'workflow', 'board'] as const;
export const schemeKindSchema = z.enum(SCHEME_KINDS);
export type SchemeKind = z.infer<typeof schemeKindSchema>;

export const schemeKindParamsSchema = z.object({ projectId: z.uuid(), kind: schemeKindSchema });

/** What projects.scheme_overrides stores per overridden kind. */
export const schemeOverrideMarkSchema = z.object({
  overriddenAt: timestampSchema,
  overriddenBy: z.string().nullable(),
});

export const SCHEME_CHANGES = ['added', 'removed', 'changed'] as const;
export const schemeChangeSchema = z.enum(SCHEME_CHANGES);

/** One row of the diff panel: a type, a field, a status, a transition or a board setting. */
export const schemeDiffEntrySchema = z.object({
  /** Stable within the kind: a type or field key, "status:<name>", "transition:<name>", a config key. */
  key: z.string(),
  label: z.string(),
  change: schemeChangeSchema,
  /** The org default's value; absent for an added row. */
  before: z.unknown().optional(),
  /** The project's value; absent for a removed row. */
  after: z.unknown().optional(),
  /** For a changed row, which attributes differ. */
  attributes: z.array(z.string()).default([]),
});

export const schemeDiffSchema = z.object({
  kind: schemeKindSchema,
  overridden: z.boolean(),
  mark: schemeOverrideMarkSchema.nullable(),
  entries: z.array(schemeDiffEntrySchema),
});

export const schemeStatusSchema = z.object({
  kind: schemeKindSchema,
  /** The org default's display name: "Software (Scrum)". */
  originName: z.string(),
  overridden: z.boolean(),
  /** Settings that differ from the origin; 0 while inherited. */
  overrideCount: z.number().int().nonnegative(),
});

export const schemesResponseSchema = z.object({ items: z.array(schemeStatusSchema) });

export type SchemeOverrideMark = z.infer<typeof schemeOverrideMarkSchema>;
export type SchemeChange = z.infer<typeof schemeChangeSchema>;
export type SchemeDiffEntry = z.infer<typeof schemeDiffEntrySchema>;
export type SchemeDiff = z.infer<typeof schemeDiffSchema>;
export type SchemeStatus = z.infer<typeof schemeStatusSchema>;
export type SchemesResponse = z.infer<typeof schemesResponseSchema>;

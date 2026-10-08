import { z } from 'zod';

/*
 * Org default schemes a project inherits or overrides: the "Inherits from" bar
 * and the sidebar notes of the Board Settings mock. An override is a full
 * copy pointing at its origin; the diff lists what differs from that origin.
 */

export const SCHEME_KINDS = ['issue_types', 'fields', 'workflow', 'board'] as const;
export const schemeKindSchema = z.enum(SCHEME_KINDS);
export type SchemeKind = z.infer<typeof schemeKindSchema>;

export const schemeStatusSchema = z.object({
  kind: schemeKindSchema,
  /** The org default's display name: "Software (Scrum)". */
  originName: z.string(),
  overridden: z.boolean(),
  /** Settings that differ from the origin; 0 while inherited. */
  overrideCount: z.number().int().nonnegative(),
});

export const schemesResponseSchema = z.object({ items: z.array(schemeStatusSchema) });

/** One differing setting, with both sides rendered as plain JSON for the diff panel. */
export const schemeDiffEntrySchema = z.object({
  /** "columns[1].wipLimit", "lanes.kind". */
  path: z.string(),
  label: z.string(),
  base: z.unknown(),
  override: z.unknown(),
});

export const schemeDiffSchema = z.object({
  kind: schemeKindSchema,
  originName: z.string(),
  entries: z.array(schemeDiffEntrySchema),
});

export const schemeKindParamsSchema = z.object({ projectId: z.uuid(), kind: schemeKindSchema });

export type SchemeStatus = z.infer<typeof schemeStatusSchema>;
export type SchemesResponse = z.infer<typeof schemesResponseSchema>;
export type SchemeDiffEntry = z.infer<typeof schemeDiffEntrySchema>;
export type SchemeDiff = z.infer<typeof schemeDiffSchema>;

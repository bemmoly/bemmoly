import { z } from 'zod';
import { hexColorSchema } from '../contracts/common.ts';
import { modePreferenceSchema, surfaceStyleSchema } from '../contracts/settings.ts';

/**
 * Custom themes (ADR 0021): a name, a brand colour and a surface style, from which the UI
 * package generates checked light and dark sets. A workspace theme can be the default; a
 * personal one is its owner's alone and only while personal themes are on.
 */
export const customThemeScopeSchema = z.enum(['workspace', 'personal']);

export const customThemeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  brandColor: hexColorSchema,
  surface: surfaceStyleSchema,
  scope: customThemeScopeSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const themeName = z.string().trim().min(1, 'Give the theme a name').max(40);

export const createCustomThemeSchema = z.object({
  name: themeName,
  brandColor: hexColorSchema,
  surface: surfaceStyleSchema,
  scope: customThemeScopeSchema,
});

export const updateCustomThemeSchema = z
  .object({ name: themeName, brandColor: hexColorSchema, surface: surfaceStyleSchema })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field');

export const customThemeParamsSchema = z.object({ id: z.uuid() });

export const customThemesResponseSchema = z.object({ items: z.array(customThemeSchema) });

/**
 * A theme a person can pick: a built-in id, or `custom:<id>` for a saved custom theme. Kept
 * as a string so a theme added later is not a schema change.
 */
export const themeRefSchema = z
  .string()
  .regex(/^([a-z][a-z0-9-]{0,39}|custom:[0-9a-f-]{36})$/, 'A theme id, e.g. "pine"');

/** A person's own appearance, stored on their account; null means the workspace default. */
export const appearancePreferenceSchema = z.object({
  mode: modePreferenceSchema.nullable(),
  /** Honoured only while the workspace lets people pick their own theme. */
  theme: themeRefSchema.nullable(),
});

export const updateAppearancePreferenceSchema = appearancePreferenceSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field');

export type CustomThemeScope = z.infer<typeof customThemeScopeSchema>;
export type CustomThemeRecord = z.infer<typeof customThemeSchema>;
export type CreateCustomThemeInput = z.infer<typeof createCustomThemeSchema>;
export type UpdateCustomThemeInput = z.infer<typeof updateCustomThemeSchema>;
export type CustomThemesResponse = z.infer<typeof customThemesResponseSchema>;
export type AppearancePreference = z.infer<typeof appearancePreferenceSchema>;
export type UpdateAppearancePreferenceInput = z.infer<typeof updateAppearancePreferenceSchema>;

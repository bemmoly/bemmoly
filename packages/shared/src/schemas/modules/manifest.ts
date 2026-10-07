import { z } from 'zod';
import { moduleIdSchema } from '../../modules/index.ts';

export const navPlacementSchema = z.enum(['top', 'settings', 'create', 'command']);

export const navEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  path: z.string().startsWith('/'),
  placement: navPlacementSchema,
});

/** What the web shell needs to know about one enabled module. */
export const moduleManifestSchema = z.object({
  id: moduleIdSchema,
  version: z.string().min(1),
  navigation: z.array(navEntrySchema),
});

export const modulesResponseSchema = z.object({
  items: z.array(moduleManifestSchema),
});

export type NavPlacement = z.infer<typeof navPlacementSchema>;
export type NavEntry = z.infer<typeof navEntrySchema>;
export type ModuleManifest = z.infer<typeof moduleManifestSchema>;
export type ModulesResponse = z.infer<typeof modulesResponseSchema>;

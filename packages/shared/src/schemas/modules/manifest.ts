import { z } from 'zod';
import { moduleIdSchema } from '../../modules/index.ts';

export const navPlacementSchema = z.enum(['top', 'settings', 'create', 'command']);

export const navEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  path: z.string().startsWith('/'),
  placement: navPlacementSchema,
});

/** One kind of result a module's search provider answers ⌘K with, and the group it shows under. */
export const searchGroupSchema = z.object({
  kind: z.string().min(1),
  label: z.string().min(1),
});

/** What the web shell needs to know about one enabled module. */
export const moduleManifestSchema = z.object({
  id: moduleIdSchema,
  /** What people call the module, e.g. "Work"; older servers leave it out. */
  name: z.string().min(1).optional(),
  version: z.string().min(1),
  navigation: z.array(navEntrySchema),
  /** Present when the module answers palette searches; the palette offers each as a scope. */
  search: z.array(searchGroupSchema).optional(),
});

export const modulesResponseSchema = z.object({
  items: z.array(moduleManifestSchema),
});

export type NavPlacement = z.infer<typeof navPlacementSchema>;
export type NavEntry = z.infer<typeof navEntrySchema>;
export type SearchGroup = z.infer<typeof searchGroupSchema>;
export type ModuleManifest = z.infer<typeof moduleManifestSchema>;
export type ModulesResponse = z.infer<typeof modulesResponseSchema>;

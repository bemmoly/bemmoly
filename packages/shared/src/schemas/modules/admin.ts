import { z } from 'zod';
import { moduleIdSchema } from '../../modules/index.ts';

export const moduleIdParamsSchema = z.object({ id: moduleIdSchema });

export const moduleChangelogStateSchema = z.enum(['pending', 'current', 'failed', 'removed']);

/** One module in the image, as Settings › Modules lists it. */
export const adminModuleSchema = z.object({
  id: moduleIdSchema,
  /** The module's display name from its manifest. */
  name: z.string().min(1),
  version: z.string(),
  enabled: z.boolean(),
  enabledAt: z.iso.datetime().nullable(),
  versionInstalled: z.string().nullable(),
  changelogState: moduleChangelogStateSchema,
  pendingChangesets: z.number().int().nonnegative(),
  dependsOn: z.array(moduleIdSchema),
  defaultAccess: z.enum(['everyone', 'teams', 'none']),
  /** True when this process cannot serve the change until it restarts. */
  restartRequired: z.boolean(),
});

export const adminModulesResponseSchema = z.object({
  items: z.array(adminModuleSchema),
  /** BEMMOLY_MODULES is set: the module set is read-only in the API. */
  pinned: z.boolean(),
});

/** "Remove data" is confirmed by typing the module id. */
export const removeModuleDataBodySchema = z.object({ confirm: moduleIdSchema });

export type AdminModule = z.infer<typeof adminModuleSchema>;
export type AdminModulesResponse = z.infer<typeof adminModulesResponseSchema>;
export type RemoveModuleDataBody = z.infer<typeof removeModuleDataBodySchema>;

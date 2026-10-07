import { z } from 'zod';
import { moduleIdSchema } from '../../modules/index.ts';

export const moduleStateSchema = z.enum(['enabled', 'disabled']);

/** Settings › Modules: every module in the image, enabled or not. */
export const adminModuleSchema = z.object({
  id: moduleIdSchema,
  name: z.string(),
  description: z.string(),
  version: z.string(),
  state: moduleStateSchema,
  dataSizeBytes: z.number().int().nonnegative().nullable(),
  changelog: z.object({
    applied: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    status: z.enum(['current', 'pending', 'failed']),
  }),
  hasData: z.boolean(),
  /** BEMMOLY_MODULES pins the set; the page is read-only then. */
  pinnedByEnv: z.boolean(),
  dependsOn: z.array(moduleIdSchema),
});

export const removeModuleDataRequestSchema = z.object({ confirm: moduleIdSchema });

export type ModuleState = z.infer<typeof moduleStateSchema>;
export type AdminModule = z.infer<typeof adminModuleSchema>;

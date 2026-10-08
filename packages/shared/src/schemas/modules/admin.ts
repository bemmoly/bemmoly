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
  /**
   * The access the module's author suggests. Only a suggestion: enabling grants exactly what
   * the admin chooses, and nobody but org admins when they choose nothing.
   */
  defaultAccess: z.enum(['everyone', 'teams', 'none']),
  /** True when this process cannot serve the change until it restarts. */
  restartRequired: z.boolean(),
});

export const adminModulesResponseSchema = z.object({
  items: z.array(adminModuleSchema),
  /** BEMMOLY_MODULES is set: the module set is read-only in the API. */
  pinned: z.boolean(),
});

/** Who may open a module once it is enabled; org admins always can. */
export const MODULE_ACCESS_MODES = ['none', 'everyone', 'teams'] as const;

export const moduleAccessModeSchema = z.enum(MODULE_ACCESS_MODES);

export const moduleAccessChoiceSchema = z
  .object({
    mode: moduleAccessModeSchema,
    /** Required for `teams`, not allowed otherwise. */
    teamIds: z.array(z.uuid()).max(100).optional(),
  })
  .refine(
    (access) =>
      access.mode === 'teams' ? (access.teamIds?.length ?? 0) > 0 : !access.teamIds?.length,
    { message: 'Choose at least one team for team access, and teams only then', path: ['teamIds'] },
  );

/** Enable: the admin's access choice; without one, nobody but org admins can open the module. */
export const enableModuleBodySchema = z.object({
  access: moduleAccessChoiceSchema.default({ mode: 'none' }),
});

/** "Remove data" is confirmed by typing the module id. */
export const removeModuleDataBodySchema = z.object({ confirm: moduleIdSchema });

export type AdminModule = z.infer<typeof adminModuleSchema>;
export type AdminModulesResponse = z.infer<typeof adminModulesResponseSchema>;
export type ModuleAccessMode = z.infer<typeof moduleAccessModeSchema>;
export type ModuleAccessChoice = z.infer<typeof moduleAccessChoiceSchema>;
export type EnableModuleBody = z.input<typeof enableModuleBodySchema>;
export type RemoveModuleDataBody = z.infer<typeof removeModuleDataBodySchema>;

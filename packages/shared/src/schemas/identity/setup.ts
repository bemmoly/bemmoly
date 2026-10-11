import { z } from 'zod';
import { modePreferenceSchema } from '../contracts/settings.ts';
import { emailSchema, passwordSchema, personNameSchema } from './common.ts';

export const setupStatusResponseSchema = z.object({
  /** true once the first admin exists; the wizard's account step is then closed. */
  initialized: z.boolean(),
  /** When the wizard's last step finished (setup.completedAt); null until then. */
  completedAt: z.string().nullable(),
  /**
   * The workspace's name, for the sign-in pages before anyone is signed in; null before the
   * wizard has named it. Older servers leave it out.
   */
  workspaceName: z.string().nullable().optional(),
  /**
   * The workspace's own logo, a same-origin path, for the sign-in pages; null without one.
   * Older servers leave it out.
   */
  logoUrl: z.string().nullable().optional(),
  /**
   * The workspace's built-in theme and default mode, so the sign-in pages wear the workspace's
   * look; null before setup or while a custom theme is chosen. Older servers leave them out.
   */
  theme: z.string().max(64).nullable().optional(),
  defaultMode: modePreferenceSchema.nullable().optional(),
});

export const createFirstAdminSchema = z.object({
  workspaceName: z.string().trim().min(1).max(100),
  workspaceUrl: z.url({ protocol: /^https?$/ }).max(300),
  name: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export type SetupStatusResponse = z.infer<typeof setupStatusResponseSchema>;
export type CreateFirstAdminInput = z.infer<typeof createFirstAdminSchema>;

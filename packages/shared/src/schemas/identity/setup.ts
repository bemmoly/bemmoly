import { z } from 'zod';
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

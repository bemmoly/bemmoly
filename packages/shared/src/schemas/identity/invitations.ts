import { z } from 'zod';
import { emailSchema } from './common.ts';

export const createInvitationsSchema = z.object({
  /** The setup wizard and People screen paste several addresses at once. */
  emails: z.array(emailSchema).min(1).max(100),
  roleId: z.uuid(),
  teamId: z.uuid().optional(),
});

export const invitationSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  roleId: z.uuid(),
  teamId: z.uuid().nullable(),
  invitedBy: z.uuid().nullable(),
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const invitationsResponseSchema = z.object({ items: z.array(invitationSchema) });

/** What the accept page shows before the person picks a name and password. Anonymous by design. */
export const invitationPreviewSchema = z.object({
  email: z.string(),
  workspaceName: z.string(),
  roleName: z.string(),
  teamName: z.string().nullable(),
  expiresAt: z.string(),
});

export type CreateInvitationsInput = z.infer<typeof createInvitationsSchema>;
export type Invitation = z.infer<typeof invitationSchema>;
export type InvitationsResponse = z.infer<typeof invitationsResponseSchema>;
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

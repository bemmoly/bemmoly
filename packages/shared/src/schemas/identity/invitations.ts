import { z } from 'zod';
import { emailSchema } from './common.ts';

export const createInvitationsSchema = z.object({
  /** The setup wizard and People screen paste several addresses at once. */
  emails: z.array(emailSchema).min(1).max(100),
  /** Without one, people join with the least-privileged role, Viewer (DEFAULT_ROLE_KEY). */
  roleId: z.uuid().optional(),
  teamId: z.uuid().optional(),
  /** Optional note from the inviter, quoted in the email. */
  message: z.string().trim().min(1).max(1000).optional(),
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

/**
 * An invitation with its accept link, returned only to the admin who issues it, so the link
 * can be shared by hand when email is not set up. The token is not stored in plain text, so a
 * link is shown once; issuing a new one replaces it.
 */
export const issuedInvitationSchema = invitationSchema.extend({
  acceptUrl: z.url({ protocol: /^https?$/ }),
});

export const createInvitationsResponseSchema = z.object({
  items: z.array(issuedInvitationSchema),
  /** False while outbound email is not configured: nobody receives the email, share the links. */
  emailConfigured: z.boolean(),
});

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
export type IssuedInvitation = z.infer<typeof issuedInvitationSchema>;
export type CreateInvitationsResponse = z.infer<typeof createInvitationsResponseSchema>;
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

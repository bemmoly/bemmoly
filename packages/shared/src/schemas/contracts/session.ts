import { z } from 'zod';
import { idSchema, passwordSchema, timestampSchema } from './common.ts';
import { roleRefSchema, userStatusSchema } from './people.ts';
import { appearanceSchema } from './settings.ts';

export const loginRequestSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const passwordResetRequestSchema = z.object({
  email: z.email('Enter a valid email address'),
});

/** The token travels in the body, not the path, so it never lands in access logs. */
export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const invitationPreviewSchema = z.object({
  email: z.email(),
  workspaceName: z.string(),
  invitedBy: z.string().nullable(),
  roleName: z.string(),
  expiresAt: timestampSchema,
});

export const acceptInvitationRequestSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(120),
  password: passwordSchema,
});

export const meSchema = z.object({
  user: z.object({
    id: idSchema,
    email: z.email(),
    name: z.string(),
    status: userStatusSchema,
    role: roleRefSchema,
    isAdmin: z.boolean(),
    capabilities: z.array(z.string()),
  }),
  workspace: z.object({
    name: z.string(),
    url: z.string(),
    appearance: appearanceSchema,
  }),
});

export const sessionResponseSchema = z.object({ user: z.object({ id: idSchema }) });

export const apiTokenSchema = z.object({
  id: idSchema,
  name: z.string(),
  scopes: z.array(z.string()),
  createdAt: timestampSchema,
  lastUsedAt: timestampSchema.nullable(),
  expiresAt: timestampSchema.nullable(),
});

export const createApiTokenRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.string()).min(1),
});

/** The secret is shown once and never again; only its hash is stored. */
export const createApiTokenResponseSchema = z.object({
  token: apiTokenSchema,
  secret: z.string().min(1),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;
export type AcceptInvitationRequest = z.infer<typeof acceptInvitationRequestSchema>;
export type Me = z.infer<typeof meSchema>;
export type ApiToken = z.infer<typeof apiTokenSchema>;
export type CreateApiTokenRequest = z.infer<typeof createApiTokenRequestSchema>;
export type CreateApiTokenResponse = z.infer<typeof createApiTokenResponseSchema>;

import { z } from 'zod';
import { emailSchema, passwordSchema, personNameSchema } from './common.ts';
import { userSchema } from './users.ts';

export const loginRequestSchema = z.object({
  email: emailSchema,
  /** Not checked against the length policy, so a password set under an older policy still works. */
  password: z.string().min(1).max(1024),
});

export const authUserResponseSchema = z.object({ user: userSchema });

export const logoutRequestSchema = z
  .object({ everywhere: z.boolean().default(false) })
  .default({ everywhere: false });

export const passwordResetRequestSchema = z.object({ email: emailSchema });

export const passwordResetCompleteSchema = z.object({
  token: z.string().min(16).max(200),
  password: passwordSchema,
});

export const sessionSchema = z.object({
  id: z.uuid(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
  expiresAt: z.string(),
  current: z.boolean(),
});

export const sessionsResponseSchema = z.object({ items: z.array(sessionSchema) });

export const invitationTokenParamsSchema = z.object({ token: z.string().min(16).max(200) });

export const acceptInvitationSchema = z.object({
  name: personNameSchema,
  password: passwordSchema,
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthUserResponse = z.infer<typeof authUserResponseSchema>;
export type LogoutRequest = z.infer<typeof logoutRequestSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetComplete = z.infer<typeof passwordResetCompleteSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SessionsResponse = z.infer<typeof sessionsResponseSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

import {
  acceptInvitationSchema,
  authUserResponseSchema,
  createFirstAdminSchema,
  invitationPreviewSchema,
  loginRequestSchema,
  meResponseSchema,
  passwordResetCompleteSchema,
  passwordResetRequestSchema,
  readinessResponseSchema,
  sessionsResponseSchema,
  setupStatusResponseSchema,
  type AcceptInvitationInput,
  type CreateFirstAdminInput,
  type LoginRequest,
  type PasswordResetComplete,
  type PasswordResetRequest,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

/** First-run wizard. Anonymous by design. */
export function setupEndpoints(http: Http) {
  return {
    status: async () => http.request('/api/v1/setup/status', setupStatusResponseSchema),
    createAdmin: async (body: CreateFirstAdminInput) =>
      http.request('/api/v1/setup/admin', authUserResponseSchema, {
        method: 'POST',
        body: validated(createFirstAdminSchema, body),
      }),
    /** Anonymous readiness probe; the wizard's first health row before an admin exists. */
    readiness: async () => http.request('/readyz', readinessResponseSchema),
  };
}

/** Sign-in flows; anonymous by design and rate limited per IP on the server. */
export function authEndpoints(http: Http) {
  return {
    login: async (body: LoginRequest) =>
      http.request('/api/v1/auth/login', authUserResponseSchema, {
        method: 'POST',
        body: validated(loginRequestSchema, body),
      }),
    logout: async (everywhere = false) =>
      http.send('/api/v1/auth/logout', { method: 'POST', body: everywhere ? { everywhere } : {} }),
    requestPasswordReset: async (body: PasswordResetRequest) =>
      http.send('/api/v1/auth/password-reset', {
        method: 'POST',
        body: validated(passwordResetRequestSchema, body),
      }),
    completePasswordReset: async (body: PasswordResetComplete) =>
      http.send('/api/v1/auth/password-reset/complete', {
        method: 'POST',
        body: validated(passwordResetCompleteSchema, body),
      }),
    invitation: async (token: string) =>
      http.request(`/api/v1/auth/invitations/${enc(token)}`, invitationPreviewSchema),
    acceptInvitation: async (token: string, body: AcceptInvitationInput) =>
      http.request(`/api/v1/auth/invitations/${enc(token)}/accept`, authUserResponseSchema, {
        method: 'POST',
        body: validated(acceptInvitationSchema, body),
      }),
    me: async () => http.request('/api/v1/me', meResponseSchema),
    sessions: async () => http.request('/api/v1/sessions', sessionsResponseSchema),
    revokeSession: async (id: string) =>
      http.send(`/api/v1/sessions/${enc(id)}`, { method: 'DELETE' }),
  };
}

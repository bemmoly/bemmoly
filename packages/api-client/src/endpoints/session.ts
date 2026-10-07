import {
  acceptInvitationRequestSchema,
  createAdminRequestSchema,
  invitationPreviewSchema,
  loginRequestSchema,
  meSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  sessionResponseSchema,
  setupStatusSchema,
  type AcceptInvitationRequest,
  type CreateAdminRequest,
  type LoginRequest,
  type PasswordResetConfirm,
  type PasswordResetRequest,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

/** First-run wizard. `status` is anonymous by design. */
export function setupEndpoints(http: Http) {
  return {
    status: async () => http.request('/api/v1/setup/status', setupStatusSchema),
    createAdmin: async (body: CreateAdminRequest) =>
      http.request('/api/v1/setup/admin', sessionResponseSchema, {
        method: 'POST',
        body: validated(createAdminRequestSchema, body),
      }),
    complete: async () => http.send('/api/v1/setup/complete', { method: 'POST' }),
  };
}

/** Sign-in flows; anonymous by design and rate limited per IP on the server. */
export function authEndpoints(http: Http) {
  return {
    login: async (body: LoginRequest) =>
      http.request('/api/v1/auth/login', sessionResponseSchema, {
        method: 'POST',
        body: validated(loginRequestSchema, body),
      }),
    logout: async () => http.send('/api/v1/auth/logout', { method: 'POST' }),
    requestPasswordReset: async (body: PasswordResetRequest) =>
      http.send('/api/v1/auth/password-reset', {
        method: 'POST',
        body: validated(passwordResetRequestSchema, body),
      }),
    confirmPasswordReset: async (body: PasswordResetConfirm) =>
      http.send('/api/v1/auth/password-reset/confirm', {
        method: 'POST',
        body: validated(passwordResetConfirmSchema, body),
      }),
    invitation: async (token: string) =>
      http.request(`/api/v1/auth/invitations/${enc(token)}`, invitationPreviewSchema),
    acceptInvitation: async (token: string, body: AcceptInvitationRequest) =>
      http.request(`/api/v1/auth/invitations/${enc(token)}/accept`, sessionResponseSchema, {
        method: 'POST',
        body: validated(acceptInvitationRequestSchema, body),
      }),
    me: async () => http.request('/api/v1/me', meSchema),
  };
}

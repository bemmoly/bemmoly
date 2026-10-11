import {
  createdScimTokenSchema,
  createScimTokenSchema,
  createSsoProviderSchema,
  scimTokensResponseSchema,
  ssoPolicySchema,
  ssoProviderSchema,
  ssoProvidersResponseSchema,
  ssoSignInOptionsResponseSchema,
  ssoTestStartedSchema,
  updateSsoPolicySchema,
  updateSsoProviderSchema,
  type CreateScimTokenInput,
  type CreateSsoProviderInput,
  type UpdateSsoPolicyInput,
  type UpdateSsoProviderInput,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

/** Where "Continue with SSO" sends the browser: a full navigation, never a fetch. */
export function ssoStartPath(providerId: string, returnTo?: string): string {
  const query = returnTo ? `?returnTo=${enc(returnTo)}` : '';
  return `/api/v1/auth/sso/providers/${enc(providerId)}/start${query}`;
}

/** Single sign-on: the sign-in page's options and Settings › Sign-in. */
export function ssoEndpoints(http: Http) {
  return {
    /** Anonymous by design: names of the enabled providers and whether SSO is required. */
    signInOptions: async () =>
      http.request('/api/v1/auth/sso/providers', ssoSignInOptionsResponseSchema),
    providers: async () => http.request('/api/v1/admin/sso/providers', ssoProvidersResponseSchema),
    createProvider: async (body: CreateSsoProviderInput) =>
      http.request('/api/v1/admin/sso/providers', ssoProviderSchema, {
        method: 'POST',
        body: validated(createSsoProviderSchema, body),
      }),
    updateProvider: async (id: string, body: UpdateSsoProviderInput) =>
      http.request(`/api/v1/admin/sso/providers/${enc(id)}`, ssoProviderSchema, {
        method: 'PATCH',
        body: validated(updateSsoProviderSchema, body),
      }),
    deleteProvider: async (id: string) =>
      http.send(`/api/v1/admin/sso/providers/${enc(id)}`, { method: 'DELETE' }),
    /** Sets the binding cookie; the caller then navigates to `authorizationUrl`. */
    startTest: async (id: string) =>
      http.request(`/api/v1/admin/sso/providers/${enc(id)}/tests`, ssoTestStartedSchema, {
        method: 'POST',
        body: {},
      }),
    policy: async () => http.request('/api/v1/admin/sso/policy', ssoPolicySchema),
    updatePolicy: async (body: UpdateSsoPolicyInput) =>
      http.request('/api/v1/admin/sso/policy', ssoPolicySchema, {
        method: 'PUT',
        body: validated(updateSsoPolicySchema, body),
      }),
    scimTokens: async () => http.request('/api/v1/admin/scim-tokens', scimTokensResponseSchema),
    createScimToken: async (body: CreateScimTokenInput) =>
      http.request('/api/v1/admin/scim-tokens', createdScimTokenSchema, {
        method: 'POST',
        body: validated(createScimTokenSchema, body),
      }),
    revokeScimToken: async (id: string) =>
      http.send(`/api/v1/admin/scim-tokens/${enc(id)}`, { method: 'DELETE' }),
  };
}

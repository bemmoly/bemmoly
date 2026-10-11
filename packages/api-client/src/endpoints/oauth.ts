import {
  createOAuthConsentSchema,
  oauthAuthorizationPreviewSchema,
  oauthAuthorizeRequestSchema,
  oauthConsentResultSchema,
  oauthGrantsResponseSchema,
  type CreateOAuthConsentInput,
  type OAuthAuthorizeRequest,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

/** MCP client sign-in: the consent screen and Profile › Access tokens › Connected apps. */
export function oauthEndpoints(http: Http) {
  return {
    /** What the consent screen shows for the request in its address. */
    preview: async (request: OAuthAuthorizeRequest) =>
      http.request('/api/v1/oauth/authorization-requests', oauthAuthorizationPreviewSchema, {
        query: validated(oauthAuthorizeRequestSchema, request),
      }),
    /** Approve or deny; the browser then goes to `redirectUrl`, back to the client. */
    decide: async (body: CreateOAuthConsentInput) =>
      http.request('/api/v1/oauth/consents', oauthConsentResultSchema, {
        method: 'POST',
        body: validated(createOAuthConsentSchema, body),
      }),
    grants: async () => http.request('/api/v1/oauth/grants', oauthGrantsResponseSchema),
    revokeGrant: async (id: string) =>
      http.send(`/api/v1/oauth/grants/${enc(id)}`, { method: 'DELETE' }),
  };
}

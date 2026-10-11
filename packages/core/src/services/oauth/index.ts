import type {
  CreateOAuthConsentInput,
  OAuthAuthorizeRequest,
  OAuthRevokeRequest,
  OAuthTokenRequest,
} from '@bemmoly/shared';
import type { RequestContext } from '../authz/index.ts';
import { decideAuthorization, previewAuthorization } from './consent.ts';
import { exposedModules, type OAuthDependencies } from './deps.ts';
import { listMyGrants, revokeMyGrant } from './grants.ts';
import { authenticateAccessToken, exchangeCode, refreshTokens, revokeToken } from './tokens.ts';
import {
  authorizationServerMetadata,
  bearerChallenge,
  protectedResourceMetadata,
  resourceCovers,
  resourceFor,
} from './urls.ts';

export {
  ACCESS_TOKEN_PREFIX,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  type OAuthDependencies,
} from './deps.ts';
export { OAuthProtocolError } from './errors.ts';
export { deleteExpiredOAuthState } from './grants.ts';
export { grantActor, type AuthenticatedGrant, type TokenResponse } from './tokens.ts';
export {
  AS_METADATA_PATH,
  bearerChallenge,
  RESOURCE_METADATA_PATH,
  resourceFor,
  REVOKE_PATH,
  TOKEN_PATH,
} from './urls.ts';

/**
 * The MCP server's authorization server: metadata, the consent decision, the token and
 * revocation endpoints, and access token checks for the MCP routes.
 */
export function createOAuthService(deps: OAuthDependencies) {
  return {
    publicUrl: deps.publicUrl,
    async authorizationServerMetadata() {
      return authorizationServerMetadata(deps.publicUrl, await exposedModules(deps));
    },
    protectedResourceMetadata: (moduleId?: string) =>
      protectedResourceMetadata(deps.publicUrl, moduleId),
    challenge: (moduleId?: string, error?: string) =>
      bearerChallenge(deps.publicUrl, moduleId, error),
    preview: (ctx: RequestContext, request: OAuthAuthorizeRequest) =>
      previewAuthorization(deps, ctx, request),
    decide: (ctx: RequestContext, input: CreateOAuthConsentInput) =>
      decideAuthorization(deps, ctx, input),
    token: (input: OAuthTokenRequest) =>
      input.grant_type === 'authorization_code'
        ? exchangeCode(deps, input)
        : refreshTokens(deps, input),
    revoke: (input: OAuthRevokeRequest) => revokeToken(deps, input),
    listGrants: (ctx: RequestContext) => listMyGrants(deps.db, ctx),
    revokeGrant: (ctx: RequestContext, id: string) => revokeMyGrant(deps.db, ctx, id),
    /** An access token for the MCP address `moduleId` names (or the whole server). */
    async authenticate(token: string, moduleId?: string) {
      const grant = await authenticateAccessToken(deps, token);
      if (!grant) return null;
      const requested = resourceFor(deps.publicUrl, moduleId);
      return resourceCovers(deps.publicUrl, grant.resource, requested) ? grant : null;
    },
  };
}

export type OAuthService = ReturnType<typeof createOAuthService>;

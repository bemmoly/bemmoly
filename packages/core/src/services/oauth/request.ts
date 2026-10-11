import {
  ForbiddenError,
  pkceChallengeSchema,
  ValidationError,
  type OAuthAccess,
  type OAuthAuthorizeRequest,
  type OAuthClientSummary,
  type OAuthModuleOption,
} from '@bemmoly/shared';
import type { OAuthClientRow } from '../../models/identity/index.ts';
import type { RequestContext } from '../authz/index.ts';
import { resolveClient } from './clients.ts';
import { exposedModules, moduleNameOf, type OAuthDependencies } from './deps.ts';
import { isLoopback, redirectMatches, withParams } from './redirects.ts';
import { parseScope } from './scopes.ts';
import { issuerOf, moduleOfResource, resourceFor } from './urls.ts';

export interface ValidRequest {
  ok: true;
  client: OAuthClientRow;
  summary: OAuthClientSummary;
  redirectUri: string;
  challenge: string;
  resource: string;
  access: OAuthAccess;
  requestedModules: string[] | null;
  options: OAuthModuleOption[];
}

export interface RefusedRequest {
  ok: false;
  summary: OAuthClientSummary;
  error: string;
  description: string;
  redirectUrl: string;
}

/** Signed in through the browser: tokens and connections cannot approve more connections. */
export function sessionUserId(ctx: RequestContext): string {
  if (ctx.actor.kind !== 'user') {
    throw new ForbiddenError('Approve app connections from a signed-in browser');
  }
  return ctx.actor.id;
}

function summaryOf(client: OAuthClientRow, redirectUri: string): OAuthClientSummary {
  const redirect = new URL(redirectUri);
  return {
    id: client.clientId,
    name: client.name,
    host: new URL(client.clientId).host,
    redirectUri,
    redirectHost: redirect.host,
    loopback: isLoopback(redirect),
  };
}

/** The error response the client receives at its redirect (RFC 6749 4.1.2.1, RFC 9207). */
export function errorRedirect(
  deps: OAuthDependencies,
  request: OAuthAuthorizeRequest,
  error: string,
  description?: string,
) {
  return withParams(request.redirect_uri, {
    error,
    error_description: description,
    state: request.state,
    iss: issuerOf(deps.publicUrl),
  });
}

/**
 * Validates an authorization request for the signed-in person. A request whose client or
 * redirect cannot be trusted throws, so it is shown on the page and never redirected anywhere;
 * any other problem is reported back to the client at its own, verified redirect.
 */
export async function validateRequest(
  deps: OAuthDependencies,
  ctx: RequestContext,
  request: OAuthAuthorizeRequest,
): Promise<ValidRequest | RefusedRequest> {
  sessionUserId(ctx);
  if (!(await deps.settings()).enabled) {
    throw new ForbiddenError('An admin has turned the MCP server off in Settings › MCP', {
      details: { reason: 'mcp_disabled' },
    });
  }
  const client = await resolveClient(deps, request.client_id);
  if (!redirectMatches(request.redirect_uri, client.redirectUris)) {
    throw new ValidationError(
      `${client.name} asked to send you back to an address it has not registered, so Bemmoly won't continue`,
      { details: { reason: 'invalid_redirect' } },
    );
  }
  const summary = summaryOf(client, request.redirect_uri);
  const refuse = (error: string, description: string): RefusedRequest => ({
    ok: false,
    summary,
    error,
    description,
    redirectUrl: errorRedirect(deps, request, error, description),
  });
  if (request.response_type !== 'code') {
    return refuse('unsupported_response_type', 'Only the authorization code flow is supported');
  }
  if (!request.code_challenge || !pkceChallengeSchema.safeParse(request.code_challenge).success) {
    return refuse('invalid_request', 'A PKCE code challenge is required');
  }
  if (request.code_challenge_method !== 'S256') {
    return refuse('invalid_request', 'The code challenge method must be S256');
  }
  const resourceModule = request.resource
    ? moduleOfResource(deps.publicUrl, request.resource)
    : null;
  const exposed = await exposedModules(deps);
  if (resourceModule === undefined || (resourceModule && !exposed.includes(resourceModule))) {
    return refuse('invalid_target', 'The resource is not an MCP server of this workspace');
  }
  const requested = parseScope(request.scope);
  const reachable = await ctx.authz.modulesFor(ctx.actor);
  const options = exposed
    .filter((id) => reachable.has(id))
    .filter((id) => !resourceModule || id === resourceModule)
    .filter((id) => !requested.modules || requested.modules.includes(id))
    .map((id) => ({ id, name: moduleNameOf(deps, id) }));
  if (options.length === 0) {
    return refuse('invalid_scope', 'None of the requested modules is open to this person');
  }
  return {
    ok: true,
    client,
    summary,
    redirectUri: request.redirect_uri,
    challenge: request.code_challenge,
    resource: resourceFor(deps.publicUrl, resourceModule ?? undefined),
    access: requested.access,
    requestedModules: requested.modules?.filter((id) => options.some((o) => o.id === id)) ?? null,
    options,
  };
}

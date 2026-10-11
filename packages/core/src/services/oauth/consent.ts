import {
  ValidationError,
  type CreateOAuthConsentInput,
  type OAuthAuthorizationPreview,
  type OAuthAuthorizeRequest,
  type OAuthConsentResult,
} from '@bemmoly/shared';
import { oauthAuthorizationCodes } from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import type { RequestContext } from '../authz/index.ts';
import { digestToken, generateToken } from '../identity/index.ts';
import { AUTHORIZATION_CODE_TTL_MS, nowOf, type OAuthDependencies } from './deps.ts';
import { withParams } from './redirects.ts';
import { errorRedirect, sessionUserId, validateRequest, type ValidRequest } from './request.ts';
import { tokenScopesFor } from './scopes.ts';
import { issuerOf } from './urls.ts';

/** What the consent screen shows for an authorization request. */
export async function previewAuthorization(
  deps: OAuthDependencies,
  ctx: RequestContext,
  request: OAuthAuthorizeRequest,
): Promise<OAuthAuthorizationPreview> {
  const checked = await validateRequest(deps, ctx, request);
  if (!checked.ok) {
    return {
      status: 'invalid',
      client: checked.summary,
      error: checked.error,
      description: checked.description,
      redirectUrl: checked.redirectUrl,
    };
  }
  return {
    status: 'ready',
    client: checked.summary,
    access: checked.access,
    requestedModules: checked.requestedModules,
    moduleOptions: checked.options,
  };
}

/** What the person chose, never more than the client asked for or they can open. */
function chosen(checked: ValidRequest, input: CreateOAuthConsentInput) {
  const access = input.access === 'read' ? 'read' : checked.access;
  const offered = checked.options.map((option) => option.id);
  if (input.modules === undefined || input.modules === null) {
    return { access, modules: checked.requestedModules };
  }
  const outside = input.modules.filter((id) => !offered.includes(id));
  if (outside.length > 0) {
    throw new ValidationError('Choose modules from the ones listed', {
      details: { modules: outside },
    });
  }
  return { access, modules: [...new Set(input.modules)] };
}

const target = (checked: ValidRequest) => ({ kind: 'oauth_client', id: checked.client.clientId });

/**
 * The person's decision. Approving stores a one-time code (its hash, the PKCE challenge and
 * what was granted) and sends the browser back with it; denying sends `access_denied`. Both
 * are audited, and both go only to the redirect the client registered.
 */
export async function decideAuthorization(
  deps: OAuthDependencies,
  ctx: RequestContext,
  input: CreateOAuthConsentInput,
): Promise<OAuthConsentResult> {
  const userId = sessionUserId(ctx);
  const checked = await validateRequest(deps, ctx, input.request);
  if (!checked.ok) return { redirectUrl: checked.redirectUrl };
  const summary = {
    client: checked.summary.name,
    redirectHost: checked.summary.redirectHost,
    resource: checked.resource,
  };
  if (!input.approve) {
    await recordAudit(deps.db, {
      actor: ctx.actor,
      action: 'oauth.authorization_denied',
      target: target(checked),
      after: summary,
      meta: ctx,
    });
    return {
      redirectUrl: errorRedirect(deps, input.request, 'access_denied', 'The person declined'),
    };
  }
  const { access, modules } = chosen(checked, input);
  const code = generateToken();
  const now = nowOf(deps);
  await deps.db.transaction(async (tx) => {
    await tx.insert(oauthAuthorizationCodes).values({
      codeHash: digestToken(code),
      clientId: checked.client.id,
      userId,
      redirectUri: checked.redirectUri,
      codeChallenge: checked.challenge,
      resource: checked.resource,
      scopes: tokenScopesFor(access),
      modules,
      expiresAt: new Date(now.getTime() + AUTHORIZATION_CODE_TTL_MS),
    });
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'oauth.authorization_approved',
      target: target(checked),
      after: { ...summary, access, modules },
      meta: ctx,
    });
  });
  return {
    redirectUrl: withParams(checked.redirectUri, {
      code,
      state: input.request.state,
      iss: issuerOf(deps.publicUrl),
    }),
  };
}

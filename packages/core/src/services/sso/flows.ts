import type { OidcCallbackQuery, SamlCallbackBody, SsoStartQuery } from '@bemmoly/shared';
import { and, eq } from 'drizzle-orm';
import { authIdentities, type AuthSsoFlowRow } from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import type { RequestContext } from '../authz/index.ts';
import {
  createSession,
  generateToken,
  revokeSession,
  type ClientInfo,
  type IssuedSession,
} from '../identity/index.ts';
import { loadProvider, type LoadedProvider } from './config.ts';
import { completeUrl, nowOf, serviceProviderUrls, type SsoDependencies } from './deps.ts';
import {
  assertBinding,
  consumeFlow,
  findFlow,
  insertFlow,
  openFlowSecrets,
  rememberAssertion,
  storeFlowResult,
} from './flow-store.ts';
import { SsoFailure, type ExternalIdentity } from './protocol.ts';
import { CONFIGURE } from './providers.ts';
import { resolvePerson } from './provisioning.ts';
import { registryHandler } from './handler.ts';
import { recordTest, type FlowResult } from './testing.ts';
import { safeReturnTo } from './return-to.ts';

export const SETTINGS_RETURN = '/settings/authentication';

export interface StartedFlow {
  redirectUrl: string;
  /** Set as the binding cookie; the callback only finishes in the browser holding it. */
  binding: { token: string; expiresAt: Date };
}

export type FlowOutcome =
  | { kind: 'signed_in'; session: IssuedSession; returnTo: string }
  | { kind: 'tested'; returnTo: string };

export type Client = ClientInfo & { requestId?: string; previousSessionId?: string | undefined };

async function begin(
  deps: SsoDependencies,
  provider: LoadedProvider,
  returnTo: string,
  testUserId: string | null,
): Promise<StartedFlow> {
  const state = generateToken();
  const binding = generateToken();
  const urls = serviceProviderUrls(deps.publicUrl, provider.row.id);
  const started = await registryHandler(deps, provider).begin({ state, urls });
  const expiresAt = await insertFlow(deps.db, deps.secrets, {
    providerId: provider.row.id,
    state,
    binding,
    secrets: started.secrets,
    requestId: started.requestId ?? null,
    returnTo,
    testUserId,
    now: nowOf(deps),
  });
  return { redirectUrl: started.redirectUrl, binding: { token: binding, expiresAt } };
}

/** Anonymous by design: "Continue with SSO" on the sign-in page. */
export async function startSignIn(
  deps: SsoDependencies,
  providerId: string,
  query: SsoStartQuery,
): Promise<StartedFlow> {
  const provider = await loadProvider(deps.db, deps.secrets, providerId);
  if (!provider.row.enabled) throw new SsoFailure('disabled', 'This sign-in method is turned off');
  return begin(deps, provider, safeReturnTo(query.returnTo), null);
}

/** Settings › Sign-in: a real round trip to the provider that signs nobody in. */
export async function startTest(
  deps: SsoDependencies,
  ctx: RequestContext,
  providerId: string,
): Promise<StartedFlow> {
  await ctx.authz.authorize(ctx.actor, CONFIGURE, { kind: 'workspace' });
  if (ctx.actor.kind !== 'user') throw new SsoFailure('state_mismatch', 'Test from a browser');
  const provider = await loadProvider(deps.db, deps.secrets, providerId);
  return begin(deps, provider, SETTINGS_RETURN, ctx.actor.id);
}

/** Opens the session for a verified person, retiring whatever session this browser held. */
async function signIn(
  deps: SsoDependencies,
  provider: LoadedProvider,
  identity: ExternalIdentity,
  flow: AuthSsoFlowRow,
  client: Client,
): Promise<FlowOutcome> {
  const now = nowOf(deps);
  const session = await deps.db.transaction(async (tx) => {
    const { user } = await resolvePerson(tx, provider, identity, client);
    if (client.previousSessionId) await revokeSession(tx, client.previousSessionId);
    const issued = await createSession(tx, {
      userId: user.id,
      privilegeVersion: user.privilegeVersion,
      client,
      now,
    });
    await tx
      .update(authIdentities)
      .set({ lastUsedAt: now })
      .where(
        and(eq(authIdentities.providerId, provider.row.id), eq(authIdentities.userId, user.id)),
      );
    await recordAudit(tx, {
      actor: { kind: 'user', id: user.id },
      action: 'session.created',
      target: { kind: 'session', id: issued.sessionId },
      after: { method: 'sso', providerId: provider.row.id, userAgent: client.userAgent ?? null },
      meta: client,
    });
    return issued;
  });
  return { kind: 'signed_in', session, returnTo: flow.returnTo };
}

async function finish(
  deps: SsoDependencies,
  provider: LoadedProvider,
  flow: AuthSsoFlowRow,
  result: FlowResult,
  client: Client,
): Promise<FlowOutcome> {
  if (flow.testUserId) {
    await recordTest(deps.db, provider, flow.testUserId, result, client);
    return { kind: 'tested', returnTo: flow.returnTo };
  }
  if (!result.ok) throw result.failure;
  return signIn(deps, provider, result.identity, flow, client);
}

async function completeWith(
  deps: SsoDependencies,
  provider: LoadedProvider,
  flow: AuthSsoFlowRow,
  params: Record<string, string>,
): Promise<FlowResult> {
  try {
    const identity = await registryHandler(deps, provider).complete({
      params,
      secrets: openFlowSecrets(deps.secrets, flow),
      requestId: flow.requestId,
      urls: serviceProviderUrls(deps.publicUrl, provider.row.id),
      now: nowOf(deps),
    });
    if (identity.assertion) await rememberAssertion(deps.db, provider.row.id, identity.assertion);
    return { ok: true, identity };
  } catch (error) {
    if (error instanceof SsoFailure) return { ok: false, failure: error };
    throw error;
  }
}

/** The OIDC redirect back: same-site GET, so the binding cookie is checked right here. */
export async function finishOidc(
  deps: SsoDependencies,
  providerId: string,
  query: OidcCallbackQuery,
  binding: string | undefined,
  client: Client,
): Promise<FlowOutcome> {
  const now = nowOf(deps);
  const flow = await findFlow(deps.db, query.state, now, providerId);
  assertBinding(flow, binding);
  await consumeFlow(deps.db, flow, now);
  const provider = await loadProvider(deps.db, deps.secrets, providerId);
  const params = Object.fromEntries(
    Object.entries(query).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  return finish(deps, provider, flow, await completeWith(deps, provider, flow, params), client);
}

/**
 * The SAML POST from the identity provider. It arrives cross-site, so the browser does not
 * send the binding cookie (SameSite=Lax): the verified result is parked on the flow and the
 * browser is sent to a same-site GET (`complete`) that checks the cookie and signs in.
 */
export async function acceptSamlResponse(
  deps: SsoDependencies,
  providerId: string,
  body: SamlCallbackBody,
): Promise<string> {
  const flow = await findFlow(deps.db, body.RelayState, nowOf(deps), providerId);
  if (flow.result) throw new SsoFailure('replayed', 'This sign-in already has a response');
  const provider = await loadProvider(deps.db, deps.secrets, providerId);
  const result = await completeWith(deps, provider, flow, { ...body });
  if (!result.ok && !flow.testUserId) throw result.failure;
  await storeFlowResult(
    deps.db,
    flow,
    result.ok
      ? { identity: result.identity }
      : { failure: { reason: result.failure.reason, message: result.failure.message } },
  );
  return completeUrl(deps.publicUrl, body.RelayState);
}

/** The same-site hop after a SAML POST. */
export async function completeSaml(
  deps: SsoDependencies,
  state: string,
  binding: string | undefined,
  client: Client,
): Promise<FlowOutcome> {
  const now = nowOf(deps);
  const flow = await findFlow(deps.db, state, now);
  assertBinding(flow, binding);
  await consumeFlow(deps.db, flow, now);
  const stored = flow.result as
    | { identity: ExternalIdentity }
    | { failure: { reason: SsoFailure['reason']; message: string } }
    | null;
  if (!stored) throw new SsoFailure('state_mismatch', 'No response arrived for this sign-in');
  const provider = await loadProvider(deps.db, deps.secrets, flow.providerId);
  const result: FlowResult =
    'identity' in stored
      ? { ok: true, identity: stored.identity }
      : { ok: false, failure: new SsoFailure(stored.failure.reason, stored.failure.message) };
  return finish(deps, provider, flow, result, client);
}

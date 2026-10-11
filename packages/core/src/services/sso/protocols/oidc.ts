import * as oidc from 'openid-client';
import { createIdpFetch } from '../../../clients/idp-fetch.ts';
import {
  SsoFailure,
  type ExternalIdentity,
  type ProtocolContext,
  type ProtocolFactory,
  type StoredOidcConfig,
} from '../protocol.ts';
import { claimGroups, claimString } from './claims.ts';

/** Discovery documents rarely change; one fetch serves every sign-in for a few minutes. */
const DISCOVERY_TTL_MS = 5 * 60 * 1000;
const discoveries = new Map<string, { at: number; config: Promise<oidc.Configuration> }>();

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** Plain http is for a provider on this machine only (development and tests). */
export function isLoopbackHttp(url: string): boolean {
  const parsed = new URL(url);
  return parsed.protocol === 'http:' && LOOPBACK.has(parsed.hostname);
}

function cacheKey(config: StoredOidcConfig): string {
  return JSON.stringify([config.issuerUrl, config.clientId, config.clientSecret ?? '']);
}

async function discover(
  config: StoredOidcConfig,
  context: ProtocolContext,
): Promise<oidc.Configuration> {
  const key = cacheKey(config);
  const cached = discoveries.get(key);
  if (cached && Date.now() - cached.at < DISCOVERY_TTL_MS) return cached.config;
  const execute = [oidc.enableNonRepudiationChecks];
  if (isLoopbackHttp(config.issuerUrl)) execute.push(oidc.allowInsecureRequests);
  const pending = oidc.discovery(
    new URL(config.issuerUrl),
    config.clientId,
    undefined,
    config.clientSecret ? oidc.ClientSecretPost(config.clientSecret) : oidc.None(),
    {
      [oidc.customFetch]: createIdpFetch(
        context.addressPolicy,
        context.fetch,
      ) as unknown as oidc.CustomFetch,
      execute,
    },
  );
  discoveries.set(key, { at: Date.now(), config: pending });
  try {
    return await pending;
  } catch (error) {
    discoveries.delete(key);
    throw new SsoFailure(
      'provider_error',
      `Could not read the identity provider's discovery document at ${config.issuerUrl}`,
      { cause: error },
    );
  }
}

/** Forget cached discovery, e.g. after an admin edits the provider. */
export function forgetOidcDiscovery(): void {
  discoveries.clear();
}

function failureOf(error: unknown): SsoFailure {
  if (error instanceof SsoFailure) return error;
  if (error instanceof oidc.AuthorizationResponseError) {
    return new SsoFailure('provider_error', `The identity provider answered ${error.error}`, {
      cause: error,
    });
  }
  if (error instanceof oidc.ResponseBodyError) {
    return new SsoFailure('provider_error', `The token endpoint answered ${error.error}`, {
      cause: error,
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  return new SsoFailure('invalid_response', `The ID token did not verify: ${message}`, {
    cause: error,
  });
}

async function groupsOf(
  configuration: oidc.Configuration,
  claims: Record<string, unknown>,
  accessToken: string,
  groupsClaim: string,
): Promise<string[]> {
  const fromToken = claimGroups(claims[groupsClaim]);
  if (claims[groupsClaim] !== undefined || !configuration.serverMetadata().userinfo_endpoint) {
    return fromToken;
  }
  const info = await oidc.fetchUserInfo(configuration, accessToken, String(claims['sub']));
  return claimGroups(info[groupsClaim]);
}

/**
 * OpenID Connect with any compliant provider: discovery, authorization code with PKCE (S256),
 * state and nonce, and an ID token checked for signature (against the provider's JWKS),
 * issuer, audience, expiry and nonce.
 */
export const createOidcProtocol: ProtocolFactory<StoredOidcConfig> = (config, context) => ({
  async begin({ state, urls }) {
    const configuration = await discover(config, context);
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const nonce = oidc.randomNonce();
    const redirect = oidc.buildAuthorizationUrl(configuration, {
      redirect_uri: urls.callbackUrl,
      scope: [...new Set(['openid', ...config.scopes])].join(' '),
      response_type: 'code',
      code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state,
      nonce,
    });
    return { redirectUrl: redirect.href, secrets: { codeVerifier, nonce } };
  },

  async complete({ params, secrets, urls }): Promise<ExternalIdentity> {
    if (params['error']) {
      throw new SsoFailure('provider_error', `The identity provider answered ${params['error']}`);
    }
    if (!secrets.codeVerifier || !secrets.nonce) {
      throw new SsoFailure('state_mismatch', 'This sign-in has no PKCE verifier or nonce');
    }
    const configuration = await discover(config, context);
    try {
      // Behind a proxy the request URL can differ; the redirect_uri registered is what counts.
      const url = new URL(urls.callbackUrl);
      for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
      const tokens = await oidc.authorizationCodeGrant(configuration, url, {
        pkceCodeVerifier: secrets.codeVerifier,
        expectedNonce: secrets.nonce,
        expectedState: params['state'] ?? '',
        idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (!claims) throw new SsoFailure('invalid_response', 'The response had no ID token');
      const record = claims as Record<string, unknown>;
      return {
        subject: claims.sub,
        email: claimString(record['email'])?.toLowerCase() ?? null,
        emailVerified: record['email_verified'] === true || record['email_verified'] === 'true',
        name: claimString(record['name']),
        groups: await groupsOf(configuration, record, tokens.access_token, config.groupsClaim),
      };
    } catch (error) {
      throw failureOf(error);
    }
  },
});

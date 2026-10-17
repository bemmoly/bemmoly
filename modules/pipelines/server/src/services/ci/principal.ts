import { createHash, randomBytes } from 'node:crypto';
import type { SqlClient } from '@bemmoly/core';
import { UnauthenticatedError } from '@bemmoly/shared';
import type { KeySource } from '../../clients/oidc/discovery.ts';
import { looksLikeJwt, unverifiedIssuer, verifyJwt } from '../../clients/oidc/jwt.ts';
import type { CiIssuerRow } from '../../models/ci.ts';
import { factsOf, type CiFacts } from './trust.ts';

/*
 * Who is registering a release from CI: a verified OIDC token from a configured issuer
 * (GitHub Actions, GitLab, CircleCI, Buildkite or any OIDC issuer), or a scoped CI token
 * for systems without OIDC. CI tokens are random, shown once and stored as SHA-256.
 */

export const CI_TOKEN_PREFIX = 'bpci_';

export type CiPrincipal =
  | { kind: 'oidc'; issuer: CiIssuerRow; facts: CiFacts; subject: string }
  | { kind: 'token'; tokenId: string; name: string; applicationIds: string[] };

export const hashCiToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function newCiToken(): { token: string; prefix: string; hash: string } {
  const token = `${CI_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  return { token, prefix: token.slice(0, CI_TOKEN_PREFIX.length + 4), hash: hashCiToken(token) };
}

export const isCiCredential = (token: string) =>
  token.startsWith(CI_TOKEN_PREFIX) || looksLikeJwt(token);

export async function authenticateCi(
  sql: SqlClient,
  keys: KeySource,
  token: string,
  audiences: readonly string[],
): Promise<CiPrincipal> {
  if (token.startsWith(CI_TOKEN_PREFIX)) {
    const [row] = await sql<{ id: string; name: string; application_ids: string[] }[]>`
      update pipeline_ci_tokens set last_used_at = now()
      where token_hash = ${hashCiToken(token)} and revoked_at is null
        and (expires_at is null or expires_at > now())
      returning id, name, application_ids`;
    if (!row) throw new UnauthenticatedError('The CI token is unknown, revoked or expired');
    return { kind: 'token', tokenId: row.id, name: row.name, applicationIds: row.application_ids };
  }
  if (!looksLikeJwt(token)) {
    throw new UnauthenticatedError('Send an OIDC token from your CI or a Pipelines CI token');
  }
  const claimedIssuer = unverifiedIssuer(token);
  const [issuer] = await sql<CiIssuerRow[]>`
    select * from pipeline_ci_issuers where issuer = ${claimedIssuer ?? ''} and enabled`;
  if (!issuer) {
    throw new UnauthenticatedError(
      `Tokens from ${claimedIssuer ?? 'an unnamed issuer'} are not trusted here; add the issuer in Platform › CI`,
    );
  }
  const claims = await verifyJwt({
    token,
    issuer: issuer.issuer,
    discoveryUrl: issuer.discovery_url,
    audiences: issuer.audience ? [issuer.audience] : audiences,
    keys,
  });
  return {
    kind: 'oidc',
    issuer,
    facts: factsOf(issuer.kind, issuer.claim_mapping, claims),
    subject: typeof claims.sub === 'string' ? claims.sub : 'unknown',
  };
}

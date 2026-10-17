import { createPublicKey, verify, type JsonWebKeyInput } from 'node:crypto';
import { UnauthenticatedError } from '@bemmoly/shared';
import type { Jwk, KeySource } from './discovery.ts';

/*
 * Verifying a CI system's OIDC token: the signature with the issuer's published key (RS256,
 * PS256 or ES256 only, never "none" or a shared secret), then issuer, audience and times
 * with a minute of clock skew. Every refusal is an UnauthenticatedError that says which
 * check failed, so a CI log tells the platform team what to fix.
 */

const SKEW_SECONDS = 60;
const ALGORITHMS: Record<string, { hash: string; ec?: true; pss?: true }> = {
  RS256: { hash: 'sha256' },
  PS256: { hash: 'sha256', pss: true },
  ES256: { hash: 'sha256', ec: true },
};

export type Claims = Record<string, unknown>;

function part(segment: string | undefined, what: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(Buffer.from(segment ?? '', 'base64url').toString('utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // Unreadable: refused below with the same words as a non-object.
  }
  throw new UnauthenticatedError(`The token's ${what} cannot be read`);
}

/** The issuer a token claims, read before verifying so the right keys can be fetched. */
export function unverifiedIssuer(token: string): string | null {
  const [, payload] = token.split('.');
  try {
    const claims = part(payload, 'claims');
    return typeof claims.iss === 'string' ? claims.iss : null;
  } catch {
    return null;
  }
}

export const looksLikeJwt = (token: string) => /^eyJ[\w-]*\.eyJ[\w-]*\.[\w-]+$/.test(token);

function checkSignature(token: string, header: Record<string, unknown>, key: Jwk): boolean {
  const algorithm = ALGORITHMS[String(header.alg)];
  if (!algorithm) return false;
  const [head, payload, signature] = token.split('.');
  try {
    const publicKey = createPublicKey({ key: key as JsonWebKeyInput['key'], format: 'jwk' });
    return verify(
      algorithm.hash,
      Buffer.from(`${head}.${payload}`),
      {
        key: publicKey,
        ...(algorithm.ec ? { dsaEncoding: 'ieee-p1363' as const } : {}),
        ...(algorithm.pss ? { padding: 6, saltLength: 32 } : {}),
      },
      Buffer.from(signature ?? '', 'base64url'),
    );
  } catch {
    // A key of another type, or a malformed one, simply does not verify.
    return false;
  }
}

export interface VerifyInput {
  token: string;
  issuer: string;
  discoveryUrl: string;
  audiences: readonly string[];
  keys: KeySource;
  nowSeconds?: number;
}

export async function verifyJwt(input: VerifyInput): Promise<Claims> {
  const [head, payload, signature] = input.token.split('.');
  if (!head || !payload || !signature) throw new UnauthenticatedError('The token is not a JWT');
  const header = part(head, 'header');
  if (!ALGORITHMS[String(header.alg)]) {
    throw new UnauthenticatedError(`Tokens signed with ${String(header.alg)} are not accepted`);
  }
  const candidates = (keys: Jwk[]) =>
    keys.filter(
      (key) => (!header.kid || key.kid === header.kid) && (!key.alg || key.alg === header.alg),
    );
  let keys = candidates(await input.keys.keys(input.issuer, input.discoveryUrl));
  if (keys.length === 0) {
    keys = candidates(await input.keys.keys(input.issuer, input.discoveryUrl, true));
  }
  if (keys.length === 0) {
    throw new UnauthenticatedError('The token is signed with a key the issuer does not publish');
  }
  if (!keys.some((key) => checkSignature(input.token, header, key))) {
    throw new UnauthenticatedError('The token signature does not match the issuer key');
  }
  const claims = part(payload, 'claims');
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (claims.iss !== input.issuer)
    throw new UnauthenticatedError('The token is from another issuer');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.some((aud) => typeof aud === 'string' && input.audiences.includes(aud))) {
    throw new UnauthenticatedError(`The token is for ${audiences.join(', ')}, not this server`);
  }
  if (typeof claims.exp !== 'number' || claims.exp + SKEW_SECONDS < now) {
    throw new UnauthenticatedError('The token has expired');
  }
  if (typeof claims.nbf === 'number' && claims.nbf - SKEW_SECONDS > now) {
    throw new UnauthenticatedError('The token is not valid yet');
  }
  return claims;
}

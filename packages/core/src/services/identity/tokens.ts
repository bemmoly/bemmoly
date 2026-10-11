import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Bearer tokens the server mints: sessions, personal API tokens, invitation links
 * and password reset links. None of them is a password. A person never chooses or
 * remembers one, and each carries 256 bits from the CSPRNG.
 */
export function generateToken(prefix = ''): string {
  return `${prefix}${randomBytes(32).toString('base64url')}`;
}

/**
 * What the database stores in place of a minted token: its sha256, hex encoded.
 *
 * A slow hash (argon2id, as passwords use) exists to make guessing low-entropy
 * human input expensive. A 256-bit random token cannot be guessed at any speed,
 * so a fast one-way digest is enough. It must also be deterministic, because
 * lookups find the row by this digest. A key would add nothing against 2^256,
 * and changing the function would orphan every stored session, API token and
 * pending link. Never pass anything a person chose; passwords go through
 * passwords.ts.
 */
export function digestToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time comparison of two hex digests of equal length. */
export function digestsEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Personal API tokens are recognisable by prefix, which secret scanners key on. */
export const PERSONAL_TOKEN_PREFIX = 'bmy_';
/** Characters of the token kept in clear so people can tell their tokens apart. */
export const PERSONAL_TOKEN_VISIBLE_CHARS = 12;

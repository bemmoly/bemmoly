import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256 bits of randomness, URL safe. Used for session, invitation and reset tokens. */
export function generateSecret(prefix = ''): string {
  return `${prefix}${randomBytes(32).toString('base64url')}`;
}

/** What the database stores in place of a secret: its sha256, hex encoded. */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

/** Constant-time comparison of two hex digests of equal length. */
export function digestsEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Personal API tokens are recognisable by prefix, which secret scanners key on. */
export const API_TOKEN_PREFIX = 'bmy_';
/** Characters of the token kept in clear so people can tell their tokens apart. */
export const API_TOKEN_VISIBLE_CHARS = 12;

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/*
 * Pool, runner and job tokens: 32 random bytes behind a prefix that says what the token is
 * (so a leaked one is recognisable in a scanner), stored only as a SHA-256 hash. The tokens
 * are random, not chosen by people, so a fast hash is enough; a slow one would only slow
 * every runner call.
 */

export type TokenKind = 'pool' | 'runner' | 'job';

const PREFIX: Record<TokenKind, string> = { pool: 'bpp', runner: 'bpr', job: 'bpj' };

export function newToken(kind: TokenKind): string {
  return `${PREFIX[kind]}_${randomBytes(32).toString('base64url')}`;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

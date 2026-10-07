import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, toPage } from './keyset.ts';
import { isSameOrigin, requestOrigin } from './origin.ts';
import {
  clearSessionCookie,
  cookiePolicyFor,
  readCookie,
  serializeSessionCookie,
} from './session-cookie.ts';

describe('session cookie', () => {
  const token = 'a'.repeat(43);

  it('reads only well-formed tokens by exact name', () => {
    expect(readCookie(`theme=dark; bemmoly_session=${token}`, 'bemmoly_session')).toBe(token);
    expect(readCookie(`xbemmoly_session=${token}`, 'bemmoly_session')).toBeUndefined();
    expect(readCookie('bemmoly_session=<script>', 'bemmoly_session')).toBeUndefined();
    expect(readCookie(undefined, 'bemmoly_session')).toBeUndefined();
  });

  it('is httpOnly and SameSite=Lax always, Secure on https', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const expires = new Date(now.getTime() + 60_000);
    const https = serializeSessionCookie(token, expires, cookiePolicyFor('https://b.test'), now);
    expect(https).toBe(
      `bemmoly_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=60; Secure`,
    );
    const http = serializeSessionCookie(
      token,
      expires,
      cookiePolicyFor('http://localhost:5173'),
      now,
    );
    expect(http).not.toContain('Secure');
    expect(clearSessionCookie({ secure: true })).toContain('Max-Age=0');
  });
});

describe('origin checks', () => {
  it('prefers Origin, falls back to Referer, ignores garbage', () => {
    expect(requestOrigin({ origin: 'https://b.test' })).toBe('https://b.test');
    expect(requestOrigin({ referer: 'https://b.test/x?y' })).toBe('https://b.test');
    expect(requestOrigin({ origin: 'null' })).toBeNull();
    expect(requestOrigin({})).toBeNull();
  });

  it('accepts the public origin or the addressed host only', () => {
    const target = { protocol: 'http', host: '10.0.0.5:8080' };
    expect(isSameOrigin('https://b.test', 'https://b.test/', target)).toBe(true);
    expect(isSameOrigin('http://10.0.0.5:8080', 'https://b.test', target)).toBe(true);
    expect(isSameOrigin('https://evil.test', 'https://b.test', target)).toBe(false);
    expect(isSameOrigin('https://b.test.evil.test', 'https://b.test', target)).toBe(false);
  });
});

describe('keyset cursors', () => {
  const id = '01900000-0000-7000-8000-000000000001';

  it('round-trips ids and rejects anything else', () => {
    expect(decodeCursor(encodeCursor(id))).toBe(id);
    expect(decodeCursor(Buffer.from("1' or 1=1").toString('base64url'))).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });

  it('trims the look-ahead row and points the cursor at the last kept row', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(toPage(rows, 2)).toEqual({ rows: rows.slice(0, 2), nextCursor: encodeCursor('b') });
    expect(toPage(rows, 3)).toEqual({ rows, nextCursor: null });
  });
});

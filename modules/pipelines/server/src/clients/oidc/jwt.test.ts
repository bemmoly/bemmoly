import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { UnauthenticatedError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { createKeySource, type Jwk, type KeySource } from './discovery.ts';
import { looksLikeJwt, unverifiedIssuer, verifyJwt } from './jwt.ts';

const ISSUER = 'https://token.actions.githubusercontent.com';
const DISCOVERY = `${ISSUER}/.well-known/openid-configuration`;
const AUDIENCE = 'https://bemmoly.acme.dev';
const NOW = 1_792_000_000;

const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

function token(
  claims: Record<string, unknown>,
  options: { kid?: string; alg?: string; key?: KeyObject } = {},
) {
  const alg = options.alg ?? 'RS256';
  const head = b64({ alg, kid: options.kid ?? 'rsa-1', typ: 'JWT' });
  const body = b64({ iss: ISSUER, aud: AUDIENCE, exp: NOW + 300, iat: NOW, ...claims });
  const data = Buffer.from(`${head}.${body}`);
  const signature =
    alg === 'ES256'
      ? sign('sha256', data, { key: options.key ?? ec.privateKey, dsaEncoding: 'ieee-p1363' })
      : sign('sha256', data, options.key ?? rsa.privateKey);
  return `${head}.${body}.${signature.toString('base64url')}`;
}

function keysOf(entries: Array<[string, KeyObject]>): KeySource {
  const keys: Jwk[] = entries.map(([kid, key]) => ({
    ...(key.export({ format: 'jwk' }) as Jwk),
    kid,
  }));
  return { keys: async () => keys };
}

const verifyWith = (keys: KeySource, value: string) =>
  verifyJwt({
    token: value,
    issuer: ISSUER,
    discoveryUrl: DISCOVERY,
    audiences: [AUDIENCE],
    keys,
    nowSeconds: NOW,
  });

describe('OIDC token verification', () => {
  const keys = keysOf([
    ['rsa-1', rsa.publicKey],
    ['ec-1', ec.publicKey],
  ]);

  it('accepts RS256 and ES256 tokens signed with a published key', async () => {
    await expect(verifyWith(keys, token({ repository: 'acme/checkout' }))).resolves.toMatchObject({
      repository: 'acme/checkout',
    });
    await expect(verifyWith(keys, token({}, { alg: 'ES256', kid: 'ec-1' }))).resolves.toBeTruthy();
  });

  it('refuses tampering, other audiences, expiry and unknown algorithms', async () => {
    const good = token({ repository: 'acme/checkout' });
    const [head, , sig] = good.split('.');
    const forged = `${head}.${b64({ iss: ISSUER, aud: AUDIENCE, exp: NOW + 300, repository: 'evil/fork' })}.${sig}`;
    await expect(verifyWith(keys, forged)).rejects.toThrow('signature does not match');
    await expect(verifyWith(keys, token({ aud: 'https://elsewhere.dev' }))).rejects.toThrow(
      'not this server',
    );
    await expect(verifyWith(keys, token({ exp: NOW - 120 }))).rejects.toThrow('expired');
    const none = `${b64({ alg: 'none' })}.${b64({ iss: ISSUER })}.x`;
    await expect(verifyWith(keys, none)).rejects.toBeInstanceOf(UnauthenticatedError);
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    await expect(verifyWith(keys, token({}, { key: other.privateKey }))).rejects.toThrow(
      'signature does not match',
    );
  });

  it('refreshes the keys once when a token names a key it has not seen', async () => {
    let calls = 0;
    const rotating: KeySource = {
      keys: async (_issuer, _url, refresh) => {
        calls += 1;
        return refresh
          ? [{ ...(rsa.publicKey.export({ format: 'jwk' }) as Jwk), kid: 'rsa-2' }]
          : [];
      },
    };
    await expect(verifyWith(rotating, token({}, { kid: 'rsa-2' }))).resolves.toBeTruthy();
    expect(calls).toBe(2);
  });

  it('reads the claimed issuer and spots JWTs', () => {
    const value = token({});
    expect(looksLikeJwt(value)).toBe(true);
    expect(looksLikeJwt('bpci_abc')).toBe(false);
    expect(unverifiedIssuer(value)).toBe(ISSUER);
  });
});

describe('the issuer key source', () => {
  it('reads discovery then JWKS, caches them, and checks the issuer matches', async () => {
    const jwk = { ...(rsa.publicKey.export({ format: 'jwk' }) as Jwk), kid: 'rsa-1' };
    const answers: Record<string, unknown> = {
      [DISCOVERY]: { issuer: ISSUER, jwks_uri: `${ISSUER}/.well-known/jwks` },
      [`${ISSUER}/.well-known/jwks`]: { keys: [jwk] },
    };
    let requests = 0;
    const fetch: typeof globalThis.fetch = async (input) => {
      requests += 1;
      const url = input instanceof Request ? input.url : String(input);
      return new Response(JSON.stringify(answers[url] ?? {}), { status: answers[url] ? 200 : 404 });
    };
    let now = 0;
    const source = createKeySource({ fetch, now: () => now });
    expect(await source.keys(ISSUER, DISCOVERY)).toEqual([jwk]);
    await source.keys(ISSUER, DISCOVERY, true);
    expect(requests).toBe(2);
    now = 61_000;
    await source.keys(ISSUER, DISCOVERY, true);
    expect(requests).toBe(4);
    await expect(source.keys('https://other.example', DISCOVERY)).rejects.toThrow('names issuer');
  });
});

import { createRestClient } from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import { z } from 'zod';

/*
 * An OIDC issuer's published keys: its discovery document, then its JWKS, each read with a
 * short timeout and cached. A token signed with a key not in the cache refreshes the keys
 * at most once a minute (issuers rotate keys; a forger must not make us hammer them).
 */

const DISCOVERY_TIMEOUT_MS = 5_000;
const KEYS_TTL_MS = 60 * 60_000;
const REFRESH_FLOOR_MS = 60_000;

const discoverySchema = z.object({ issuer: z.string(), jwks_uri: z.url({ protocol: /^https$/ }) });
export const jwkSchema = z
  .object({ kty: z.string(), kid: z.string().optional(), alg: z.string().optional() })
  .loose();
const jwksSchema = z.object({ keys: z.array(jwkSchema) });

export type Jwk = z.infer<typeof jwkSchema>;

export interface KeySource {
  /** The issuer's keys; `refresh` asks again when a token names a key we do not have. */
  keys(issuer: string, discoveryUrl: string, refresh?: boolean): Promise<Jwk[]>;
}

export interface KeySourceOptions {
  fetch?: typeof fetch;
  now?: () => number;
}

async function getJson(url: string, fetchImpl: typeof fetch | undefined): Promise<unknown> {
  const target = new URL(url);
  const client = createRestClient({
    baseUrl: target.origin,
    timeoutMs: DISCOVERY_TIMEOUT_MS,
    maxRetries: 1,
    maxBytes: 1 << 20,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
  try {
    return await client.getJson(`${target.pathname}${target.search}`);
  } catch (error) {
    throw new ProviderError(`Could not read ${url}: ${(error as Error).message}`, { cause: error });
  }
}

export function createKeySource(options: KeySourceOptions = {}): KeySource {
  const now = options.now ?? Date.now;
  const cache = new Map<string, { keys: Jwk[]; at: number }>();
  // One read per issuer at a time, and a failed read is not retried for a minute: a burst
  // of forged tokens, or an issuer that is down, costs the issuer one request a minute.
  const inFlight = new Map<string, Promise<Jwk[]>>();
  const failures = new Map<string, { error: unknown; at: number }>();

  async function read(issuer: string, discoveryUrl: string): Promise<Jwk[]> {
    const discovery = discoverySchema.parse(await getJson(discoveryUrl, options.fetch));
    if (discovery.issuer !== issuer) {
      throw new ProviderError(`${discoveryUrl} names issuer ${discovery.issuer}, not ${issuer}`);
    }
    const jwks = jwksSchema.parse(await getJson(discovery.jwks_uri, options.fetch));
    cache.set(issuer, { keys: jwks.keys, at: now() });
    failures.delete(issuer);
    return jwks.keys;
  }

  return {
    async keys(issuer, discoveryUrl, refresh = false) {
      const cached = cache.get(issuer);
      const fresh = cached && now() - cached.at < KEYS_TTL_MS;
      const mayRefresh = !cached || now() - cached.at >= REFRESH_FLOOR_MS;
      if (cached && fresh && !(refresh && mayRefresh)) return cached.keys;
      const failed = failures.get(issuer);
      if (failed && now() - failed.at < REFRESH_FLOOR_MS) {
        if (cached && fresh) return cached.keys;
        throw failed.error;
      }
      let pending = inFlight.get(issuer);
      if (!pending) {
        pending = read(issuer, discoveryUrl)
          .catch((error: unknown) => {
            failures.set(issuer, { error, at: now() });
            throw error;
          })
          .finally(() => inFlight.delete(issuer));
        inFlight.set(issuer, pending);
      }
      return pending;
    },
  };
}

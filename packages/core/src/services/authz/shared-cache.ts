/**
 * The channel the 0114 triggers notify when a role, membership, grant, user or API token
 * changes. Every process listens and drops its whole authorization cache.
 */
export const AUTHZ_CHANNEL = 'bemmoly_authz';

/** How long an answer may be reused when no notification arrives (a lost LISTEN connection). */
export const AUTHZ_CACHE_TTL_MS = 5_000;

/** Past this many entries the cache starts over, so random tokens cannot grow it without end. */
const MAX_ENTRIES = 20_000;

interface Entry {
  value: Promise<unknown>;
  expiresAt: number;
}

export interface AuthorizationCacheOptions {
  ttlMs?: number;
  now?: () => number;
}

/**
 * Authorization lookups shared by every request in the process: principals, module sets,
 * memberships, resolved capability sets and API tokens, each for at most `ttlMs`. Writes reach
 * it through `clear()`, which the server calls on every bemmoly_authz notification (from this
 * process or any other replica) and whenever the LISTEN connection (re)connects, so a revoked
 * token or a deactivated person loses access as soon as the change commits, and in any case
 * within the TTL. A failed load is never kept, and a load that was in flight when the cache
 * was cleared lands nowhere, so it cannot put back an answer the clear meant to drop.
 */
export class AuthorizationCache {
  readonly #entries = new Map<string, Entry>();
  readonly #ttlMs: number;
  readonly #now: () => number;

  constructor(options: AuthorizationCacheOptions = {}) {
    this.#ttlMs = options.ttlMs ?? AUTHZ_CACHE_TTL_MS;
    this.#now = options.now ?? Date.now;
  }

  get size(): number {
    return this.#entries.size;
  }

  memo<T>(key: string, load: () => Promise<T>): Promise<T> {
    const now = this.#now();
    const found = this.#entries.get(key);
    if (found && found.expiresAt > now) return found.value as Promise<T>;
    if (found) this.#entries.delete(key);
    if (this.#entries.size >= MAX_ENTRIES) this.#entries.clear();
    const value = load();
    const entry: Entry = { value, expiresAt: now + this.#ttlMs };
    this.#entries.set(key, entry);
    value.catch(() => {
      if (this.#entries.get(key) === entry) this.#entries.delete(key);
    });
    return value;
  }

  /** Drops one entry, e.g. a token whose answer turned out to be unusable. */
  forget(key: string): void {
    this.#entries.delete(key);
  }

  clear(): void {
    this.#entries.clear();
  }
}

/**
 * The server's one cache. Only the server's own wiring passes it to authorization; tests and
 * tools that write the tables directly get a per-request cache only, as before.
 */
export const processAuthorizationCache = new AuthorizationCache();

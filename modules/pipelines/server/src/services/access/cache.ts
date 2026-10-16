import type { SqlClient } from '@bemmoly/core';
import type { CachedFacts } from './facts.ts';

/*
 * Effective permissions per (person, target), cached in process (architecture §10.1,
 * following ADR 0036). Each entry carries the access stamp it was computed under; the
 * stamp is one primary-key read per decision, bumped by triggers in the same transaction as
 * any binding, policy, owner or membership change, so a revoked grant is never served from
 * the cache on any replica. Bounded, oldest entries first out.
 */

const MAX_ENTRIES = 5_000;

export interface FactsCache {
  stamp(): Promise<bigint>;
  get(key: string, stamp: bigint): CachedFacts | undefined;
  set(key: string, stamp: bigint, facts: CachedFacts): void;
  clear(): void;
}

export function createFactsCache(sql: () => SqlClient): FactsCache {
  const entries = new Map<string, { stamp: bigint; facts: CachedFacts }>();
  return {
    async stamp() {
      const [row] = await sql()<{ stamp: string }[]>`
        select stamp::text as stamp from pipeline_access_stamps where id = 1`;
      return BigInt(row?.stamp ?? '0');
    },
    get(key, stamp) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.stamp !== stamp) {
        entries.delete(key);
        return undefined;
      }
      // Refresh its place so the oldest-first eviction keeps hot entries.
      entries.delete(key);
      entries.set(key, entry);
      return entry.facts;
    },
    set(key, stamp, facts) {
      entries.set(key, { stamp, facts });
      if (entries.size > MAX_ENTRIES) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
    },
    clear: () => entries.clear(),
  };
}

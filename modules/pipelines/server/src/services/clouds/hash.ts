import { createHash } from 'node:crypto';

/*
 * Spec hashes: the same declaration always hashes the same, whatever order its keys were
 * written in, so "nothing changed" is a string comparison and a job keyed by the hash runs
 * once per change.
 */

/** JSON with object keys sorted at every depth; arrays keep their order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, inner]) => inner !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonicalJson(inner)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function specHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

/** A short, stable suffix from any text, for names that must be unique and short. */
export function shortHash(value: string, length = 4): string {
  return createHash('sha256').update(value).digest('hex').slice(0, length);
}

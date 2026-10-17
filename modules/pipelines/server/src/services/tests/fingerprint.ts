import { createHash } from 'node:crypto';
import { stripAnsi } from '../logs/ansi.ts';

/*
 * Failure fingerprints: the first error line with everything that differs between two
 * occurrences of the same failure masked (ids, numbers, times, temporary paths, hosts), so
 * "connect ECONNREFUSED 10.4.1.7:5432" in one service and "…10.4.2.9:5432" in another group
 * together as one failure that hit both.
 */

const RULES: ReadonlyArray<[RegExp, string]> = [
  [/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?\b/g, '<time>'],
  [/\b\d{1,2}:\d{2}:\d{2}(\.\d+)?\b/g, '<time>'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>'],
  [/\bhttps?:\/\/[^\s'"]+/g, '<url>'],
  [/\b(\d{1,3}\.){3}\d{1,3}\b/g, '<ip>'],
  [/(\/tmp|\/var\/folders|\/private\/var)\/[^\s'":]+/g, '<tmp>'],
  [/\b0x[0-9a-f]+\b/gi, '<hex>'],
  [/\b[0-9a-f]{7,64}\b/gi, '<hex>'],
  [/:\d+(:\d+)?\b/g, ':<n>'],
  [/\b\d+(\.\d+)?(ms|s|m|h|kb|mb|gb|b)?\b/gi, '<n>'],
  [/\s+/g, ' '],
];

export function normaliseFailure(line: string): string {
  let text = stripAnsi(line).trim();
  for (const [pattern, replacement] of RULES) text = text.replace(pattern, replacement);
  return text.slice(0, 500);
}

/** 16 hex characters: plenty to tell failures apart, short enough for a URL. */
export function fingerprintOf(line: string | null | undefined): string | null {
  if (!line) return null;
  const normalised = normaliseFailure(line);
  if (!normalised) return null;
  return createHash('sha256').update(normalised).digest('hex').slice(0, 16);
}

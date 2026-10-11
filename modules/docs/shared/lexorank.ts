import { z } from 'zod';

/*
 * Sibling order in a page tree is a lexorank: a lowercase string compared as text,
 * read as a base-26 fraction (a = 0, z = 25) that never ends in "a" so every
 * rank has one spelling. A drop writes one row's rank; the client computes a
 * provisional one for optimistic drops and the server is the authority.
 */

const BASE = 26;
const FIRST_DIGIT = 'a'.charCodeAt(0);

/** Ranks longer than this mean a project's list has been dropped into many times; rebalance. */
export const REBALANCE_LENGTH = 64;

export const LEXORANK_PATTERN = /^[a-z]*[b-z]$/;

export const lexorankSchema = z
  .string()
  .max(255)
  .regex(LEXORANK_PATTERN, 'A rank is lowercase letters and does not end in "a"');

export type Lexorank = z.infer<typeof lexorankSchema>;

export function isLexorank(value: string): value is Lexorank {
  return LEXORANK_PATTERN.test(value);
}

const digit = (rank: string, index: number): number =>
  index < rank.length ? rank.charCodeAt(index) - FIRST_DIGIT : 0;

const char = (value: number): string => String.fromCharCode(FIRST_DIGIT + value);

function assertRank(value: string | null, name: string): void {
  if (value !== null && !isLexorank(value)) {
    throw new RangeError(`${name} "${value}" is not a lexorank`);
  }
}

/**
 * A rank strictly between two neighbours; null stands for the start or the
 * end of the list. Once a digit of the lower bound is one below the upper
 * bound's, the rest of the result only has to exceed the lower bound's tail.
 */
export function between(before: string | null, after: string | null): Lexorank {
  assertRank(before, 'before');
  assertRank(after, 'after');
  const lower = before ?? '';
  let upper = after;
  if (upper !== null && lower >= upper) {
    throw new RangeError(`"${lower}" must sort before "${upper}"`);
  }
  let out = '';
  for (let i = 0; ; i++) {
    const low = digit(lower, i);
    if (upper === null) {
      if (low === BASE - 1) {
        out += char(low);
        continue;
      }
      return out + char(low + Math.floor((BASE - low) / 2));
    }
    const high = digit(upper, i);
    if (low === high) {
      out += char(low);
      continue;
    }
    if (high - low > 1) return out + char(low + Math.floor((high - low) / 2));
    out += char(low);
    upper = null;
  }
}

/** The rank before `current`, or the opening rank of an empty list. */
export function first(current?: string): Lexorank {
  return between(null, current ?? null);
}

/** The rank after `current`, or the opening rank of an empty list. */
export function last(current?: string): Lexorank {
  return between(current ?? null, null);
}

export function compareRanks(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** True when any rank has grown past the length the rebalance job resets. */
export function needsRebalance(ranks: Iterable<string>, maxLength = REBALANCE_LENGTH): boolean {
  for (const rank of ranks) if (rank.length > maxLength) return true;
  return false;
}

/**
 * `count` evenly spaced ranks, shortest first: what the rebalance job writes
 * back over a long list, leaving room on both sides and between every pair.
 */
export function spread(count: number): Lexorank[] {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('count must be a whole number');
  let length = 1;
  while (BASE ** length <= count + 1) length += 1;
  const span = BASE ** length;
  const ranks: Lexorank[] = [];
  for (let position = 1; position <= count; position++) {
    let value = Math.floor((position * span) / (count + 1));
    let rank = '';
    for (let place = 0; place < length; place++) {
      rank = char(value % BASE) + rank;
      value = Math.floor(value / BASE);
    }
    ranks.push(rank.replace(/a+$/, ''));
  }
  return ranks;
}

/*
 * A seeded random source, so every run of the demo seed draws the same organisation and the
 * same history (shifted to end at "now"). mulberry32: tiny, fast and good enough for data.
 */

export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Picks by weight; weights need not sum to 1. */
  weighted<T>(items: readonly (readonly [T, number])[]): T;
  shuffle<T>(items: T[]): T[];
  hex(length: number): string;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const rng: Rng = {
    next,
    int,
    chance: (probability) => next() < probability,
    pick<T>(items: readonly T[]): T {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error('pick from an empty list');
      return item;
    },
    weighted<T>(items: readonly (readonly [T, number])[]): T {
      const total = items.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = next() * total;
      for (const [item, weight] of items) {
        roll -= weight;
        if (roll < 0) return item;
      }
      const last = items[items.length - 1];
      if (!last) throw new Error('weighted pick from an empty list');
      return last[0];
    },
    shuffle<T>(items: T[]): T[] {
      for (let i = items.length - 1; i > 0; i -= 1) {
        const j = int(0, i);
        [items[i], items[j]] = [items[j] as T, items[i] as T];
      }
      return items;
    },
    hex(length) {
      let out = '';
      while (out.length < length) out += Math.floor(next() * 16).toString(16);
      return out;
    },
  };
  return rng;
}

/**
 * A UUIDv7 for a given moment: the seed knows when each row "happened", and ids that sort by
 * that time keep the tables' physical order close to what a real install would have.
 */
export function uuidv7(rng: Rng, at: Date | number): string {
  const ms = typeof at === 'number' ? at : at.getTime();
  const time = Math.max(0, Math.floor(ms)).toString(16).padStart(12, '0').slice(-12);
  const variant = (8 + rng.int(0, 3)).toString(16);
  return `${time.slice(0, 8)}-${time.slice(8, 12)}-7${rng.hex(3)}-${variant}${rng.hex(3)}-${rng.hex(12)}`;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/*
 * The Monte Carlo at the heart of the forecast. Each simulated future replays the project's
 * own history: every period it finishes as much as one past period did, picked at random,
 * scaled by the share of the team the item gets, until nothing is left. A thousand futures
 * give a spread of finishing times; the 15th, 50th and 85th percentiles are the range and
 * the likely value. The random numbers come from a generator seeded by the inputs, so the
 * same history and the same work always give the same answer, on every server and in tests.
 */

export const TRIALS = 1000;

/** Past three years of periods a future is called beyond forecasting. */
export const HORIZON_PERIODS = 156;

export const PERCENTILES = { earliest: 0.15, likely: 0.5, latest: 0.85 } as const;

/** FNV-1a: a stable 32-bit hash of the seed text. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

/** Mulberry32: small, fast and good enough to shuffle a history; never for secrets. */
export function seededRandom(seed: string): () => number {
  let state = hash(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export interface SimulationInput {
  /** Work left, in the history's unit. */
  remaining: number;
  /** Finished per period, oldest first. */
  samples: readonly number[];
  /** The fraction of the team's pace this work gets, above 0 and at most 1. */
  share: number;
  /** Anything that identifies the question; the same seed draws the same futures. */
  seed: string;
}

/** Periods until done, at each percentile; Infinity past the horizon. */
export interface Simulation {
  earliest: number;
  likely: number;
  latest: number;
}

/** The value at a percentile of sorted values, by nearest rank. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil(p * sorted.length)));
  return sorted[rank - 1] ?? Number.NaN;
}

/** One future: periods until the work runs out, the last one counted in part. */
function oneFuture(input: SimulationInput, random: () => number): number {
  let left = input.remaining;
  let periods = 0;
  while (left > 0) {
    if (periods >= HORIZON_PERIODS) return Number.POSITIVE_INFINITY;
    const sample = input.samples[Math.floor(random() * input.samples.length)] ?? 0;
    const pace = sample * input.share;
    if (pace >= left) return periods + left / pace;
    left -= pace;
    periods += 1;
  }
  return periods;
}

/**
 * The spread of finishing times, or null when the history cannot finish anything (no period
 * finished any work) or there is no history at all.
 */
export function simulate(input: SimulationInput): Simulation | null {
  if (input.remaining <= 0) return { earliest: 0, likely: 0, latest: 0 };
  if (input.samples.length === 0 || !input.samples.some((sample) => sample > 0)) return null;
  const share = Math.min(1, Math.max(input.share, Number.EPSILON));
  const random = seededRandom(`${input.seed}|${input.remaining}|${input.samples.join(',')}`);
  const futures = Array.from({ length: TRIALS }, () => oneFuture({ ...input, share }, random));
  futures.sort((a, b) => a - b);
  return {
    earliest: percentile(futures, PERCENTILES.earliest),
    likely: percentile(futures, PERCENTILES.likely),
    latest: percentile(futures, PERCENTILES.latest),
  };
}

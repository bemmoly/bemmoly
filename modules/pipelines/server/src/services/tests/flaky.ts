/*
 * When a test counts as flaky. Two signals, both cheap: it failed and then passed on the
 * same commit (a retry fixed it, so the code did not), or its recent outcomes on the
 * default branch keep flipping. Outcomes are a string of p and f, oldest first, at most 50.
 */

export const RECENT_OUTCOMES = 50;
/** Flips in the last 20 outcomes on the default branch that make a test intermittent. */
export const INTERMITTENT_FLIPS = 3;

export function pushOutcome(recent: string, outcome: 'p' | 'f'): string {
  return `${recent}${outcome}`.slice(-RECENT_OUTCOMES);
}

export function flips(recent: string, window = 20): number {
  const tail = recent.slice(-window);
  let count = 0;
  for (let i = 1; i < tail.length; i += 1) if (tail[i] !== tail[i - 1]) count += 1;
  return count;
}

export function isIntermittent(recent: string): boolean {
  return recent.includes('f') && recent.includes('p') && flips(recent) >= INTERMITTENT_FLIPS;
}

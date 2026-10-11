import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { trimLeadingSlashes, trimSlashes, trimTrailingSlashes } from './slashes.ts';

describe('slash trimming', () => {
  it('trims only the requested side', () => {
    expect(trimTrailingSlashes('https://b.test///')).toBe('https://b.test');
    expect(trimTrailingSlashes('/a/b')).toBe('/a/b');
    expect(trimTrailingSlashes('///')).toBe('');
    expect(trimLeadingSlashes('//a/b/')).toBe('a/b/');
    expect(trimSlashes('/folder/set/')).toBe('folder/set');
    expect(trimSlashes('')).toBe('');
  });

  it('stays linear on a long run of slashes that does not end the string', () => {
    const hostile = `a${'/'.repeat(100_000)}x`;
    const start = performance.now();
    expect(trimTrailingSlashes(hostile)).toBe(hostile);
    expect(trimSlashes(hostile)).toBe(hostile);
    // A quadratic pass over 100,000 characters takes seconds (4 s for a backtracking regex on
    // a fast laptop) and a linear one a few milliseconds. A 1 s bound still fails the first and
    // holds on a loaded CI runner, where 50 ms did not.
    expect(performance.now() - start).toBeLessThan(1_000);
  });
});

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
    expect(performance.now() - start).toBeLessThan(50);
  });
});

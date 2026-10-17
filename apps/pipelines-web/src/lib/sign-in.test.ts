import { describe, expect, it } from 'vitest';
import { placeAt } from '../shell/places.ts';
import { formatDuration, formatShare } from './format.ts';
import { signInUrl } from './sign-in.ts';

describe('signing in and back', () => {
  it('sends people to Bemmoly’s sign-in with the way back to where they were', () => {
    expect(signInUrl({ pathname: '/pipelines/catalog', search: '?scope=commerce' })).toBe(
      '/login?redirect=%2Fpipelines%2Fcatalog%3Fscope%3Dcommerce',
    );
    expect(signInUrl({ pathname: '/elsewhere', search: '' })).toBe(
      '/login?redirect=%2Fpipelines%2F',
    );
  });
});

describe('places and formats', () => {
  it('finds the place an address is in, For you only at the root', () => {
    expect(placeAt('/pipelines/')?.id).toBe('forYou');
    expect(placeAt('/pipelines/map')?.id).toBe('map');
    expect(placeAt('/pipelines/runs/123')?.id).toBe('runs');
    expect(placeAt('/pipelines/mapping')).toBeUndefined();
  });

  it('writes lead times and shares the way the header shows them', () => {
    expect(formatDuration(3 * 3600 + 10 * 60, 'en')).toMatch(/3\s?h.*10\s?m/);
    expect(formatDuration(42, 'en')).toMatch(/42\s?s/);
    expect(formatShare(0.021, 'en')).toBe('2.1%');
  });
});

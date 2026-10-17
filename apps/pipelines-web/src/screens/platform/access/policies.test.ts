import { describe, expect, it } from 'vitest';
import { tierOf } from './policies.tsx';

describe('tierOf', () => {
  it('reads the tier a policy selects, or none', () => {
    expect(tierOf({ applies: 'application.tier == 0 && env.class == "prod"' })).toBe(0);
    expect(tierOf({ applies: 'application.tier==2' })).toBe(2);
    expect(tierOf({ applies: 'env.class == "prod"' })).toBeNull();
  });
});

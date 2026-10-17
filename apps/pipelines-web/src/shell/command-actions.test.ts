import { describe, expect, it } from 'vitest';
import { parseIntent } from './command-actions.tsx';

describe('palette verbs', () => {
  it.each([
    ['roll back pricing-svc', 'rollback', 'pricing-svc'],
    ['rollback pricing', 'rollback', 'pricing'],
    ['Run checkout-api', 'run', 'checkout-api'],
    ['who owns search-api', 'owner', 'search-api'],
    ['deploy ledger', 'promote', 'ledger'],
  ])('reads "%s" as %s of %s', (query, verb, rest) => {
    expect(parseIntent(query)).toEqual({ verb, rest });
  });

  it('leaves a plain search alone, even one that starts like a verb', () => {
    expect(parseIntent('runner-pool')).toEqual({ verb: null, rest: 'runner-pool' });
    expect(parseIntent('checkout')).toEqual({ verb: null, rest: 'checkout' });
  });
});

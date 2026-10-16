import { describe, expect, it } from 'vitest';
import { ordinal, possessive } from './waits.ts';

describe('wait reason words', () => {
  it('says places and owners the way people write them', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 102].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '102nd',
    ]);
    expect(possessive('Payments')).toBe("Payments'");
    expect(possessive('Search')).toBe("Search's");
  });
});

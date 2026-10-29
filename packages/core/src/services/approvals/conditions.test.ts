import { describe, expect, it } from 'vitest';
import { allHold, holds } from './conditions.ts';

describe('approval conditions', () => {
  const fields = { amount: 640, currency: 'EUR', costCentre: null, travel: true };

  it('compares numbers and strings, never one with the other', () => {
    expect(holds({ field: 'amount', op: 'gt', value: 500 }, fields)).toBe(true);
    expect(holds({ field: 'amount', op: 'lte', value: 640 }, fields)).toBe(true);
    expect(holds({ field: 'amount', op: 'lt', value: 100 }, fields)).toBe(false);
    expect(holds({ field: 'amount', op: 'gt', value: '500' }, fields)).toBe(false);
    expect(holds({ field: 'currency', op: 'gte', value: 'EUR' }, fields)).toBe(true);
  });

  it('matches equality, membership and presence', () => {
    expect(holds({ field: 'currency', op: 'eq', value: 'EUR' }, fields)).toBe(true);
    expect(holds({ field: 'currency', op: 'neq', value: 'USD' }, fields)).toBe(true);
    expect(holds({ field: 'currency', op: 'in', value: ['USD', 'EUR'] }, fields)).toBe(true);
    expect(holds({ field: 'travel', op: 'eq', value: true }, fields)).toBe(true);
    expect(holds({ field: 'costCentre', op: 'exists' }, fields)).toBe(false);
    expect(holds({ field: 'costCentre', op: 'exists', value: false }, fields)).toBe(true);
  });

  it('fails every operator on a missing field except a negated exists', () => {
    expect(holds({ field: 'days', op: 'lt', value: 3 }, fields)).toBe(false);
    expect(holds({ field: 'days', op: 'neq', value: 3 }, fields)).toBe(false);
    expect(holds({ field: 'days', op: 'exists', value: false }, fields)).toBe(true);
  });

  it('needs every condition of a list, and holds for an empty one', () => {
    expect(allHold([], fields)).toBe(true);
    expect(
      allHold(
        [
          { field: 'amount', op: 'gt', value: 500 },
          { field: 'currency', op: 'eq', value: 'USD' },
        ],
        fields,
      ),
    ).toBe(false);
  });
});

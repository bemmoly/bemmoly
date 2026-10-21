/**
 * The savings calculator saves exactly the Jira list price per person, because Bemmoly charges
 * nothing per person, and keeps a typed team size to a whole number in range.
 */
import { describe, expect, it } from 'vitest';
import { JIRA_PLANS, JIRA_PRICING_AS_OF } from '../src/data/jira-pricing.ts';
import {
  BEMMOLY_PER_USER_MONTHLY,
  MAX_PEOPLE,
  peopleFrom,
  savings,
  usd,
} from '../src/lib/savings.ts';

describe('savings', () => {
  it('charges nothing per person for Bemmoly', () => {
    expect(BEMMOLY_PER_USER_MONTHLY).toBe(0);
  });

  it('saves the plan price per person, monthly and yearly', () => {
    const monthly = Math.round(JIRA_PLANS.standard.perUserMonthly * 1000) / 100;
    expect(savings(10, 'standard')).toEqual({
      people: 10,
      monthly,
      yearly: Math.round(monthly * 1200) / 100,
    });
    expect(savings(25, 'premium').monthly).toBeGreaterThan(savings(25, 'standard').monthly);
  });

  it('keeps the team size whole and in range', () => {
    expect(peopleFrom('')).toBe(1);
    expect(peopleFrom('-4')).toBe(1);
    expect(peopleFrom('12.7')).toBe(12);
    expect(peopleFrom('abc')).toBe(1);
    expect(peopleFrom(10 ** 9)).toBe(MAX_PEOPLE);
  });

  it('formats dollars without stray cents', () => {
    expect(usd(1200)).toBe('$1,200');
    expect(usd(75.3)).toBe('$75.30');
  });

  it('dates the prices it uses', () => {
    expect(JIRA_PRICING_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

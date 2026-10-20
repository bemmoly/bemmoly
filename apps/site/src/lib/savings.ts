/**
 * The savings calculator's rule, kept pure for tests/savings.test.ts. Bemmoly has no licence or
 * per-seat fee (the "No subscription" promise), so the saving is the Jira subscription the team
 * would no longer pay. The server Bemmoly runs on is a cost the page states beside the answer,
 * in its own currency, and is not subtracted here.
 */
import { JIRA_PLANS, type JiraPlan } from '../data/jira-pricing.ts';

export const BEMMOLY_PER_USER_MONTHLY = 0;
export const MIN_PEOPLE = 1;
export const MAX_PEOPLE = 100_000;
export const START_PEOPLE = 25;

export interface Savings {
  people: number;
  monthly: number;
  yearly: number;
}

/** A typed team size, kept to a whole number the calculator accepts. */
export function peopleFrom(value: string | number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < MIN_PEOPLE) return MIN_PEOPLE;
  return Math.min(n, MAX_PEOPLE);
}

const cents = (value: number) => Math.round(value * 100) / 100;

export function savings(people: number, plan: JiraPlan): Savings {
  const size = peopleFrom(people);
  const monthly = cents(size * (JIRA_PLANS[plan].perUserMonthly - BEMMOLY_PER_USER_MONTHLY));
  return { people: size, monthly, yearly: cents(monthly * 12) };
}

export const usd = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });

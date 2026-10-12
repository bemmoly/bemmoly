/**
 * Monthly list prices per server size, from prices.json: each provider with the page the price
 * was read from, the day it was checked, its currency and its caveats. Prices are shown in the
 * currency billed and never converted; the exchange factor in the file only orders the list.
 * tests/capacity.test.ts fails once a checked date is more than 90 days old.
 */
import data from './prices.json';

export type Currency = 'USD' | 'EUR';

export interface Plan {
  plan: string;
  vcpu: number;
  ramGb: number;
  monthly: number | null;
  verified: boolean;
  promo?: boolean;
}

export interface Provider {
  provider: string;
  region: string;
  currency: Currency;
  url: string;
  checked: string;
  caveats: string;
  plans: Record<string, Plan | null>;
}

export const PRICES = data as {
  basis: string;
  eurToUsdForOrdering: number;
  providers: Provider[];
};

/** How old a price may get before the build asks for it to be checked again. */
export const MAX_PRICE_AGE_DAYS = 90;

export interface Offer extends Plan {
  provider: Provider;
  monthly: number;
  /** The plan is exactly the size asked for. */
  exact: boolean;
}

export const money = (monthly: number, currency: Currency) =>
  `${currency === 'EUR' ? '€' : '$'}${Number.isInteger(monthly) ? monthly : monthly.toFixed(2)}`;

export const offerMoney = (offer: Offer) => money(offer.monthly, offer.provider.currency);

const ordering = (offer: Offer) =>
  offer.monthly * (offer.provider.currency === 'EUR' ? PRICES.eurToUsdForOrdering : 1);

/** Every priced plan for a size (key "cpu-ramGb"), cheapest first. */
export function offersFor(key: string): Offer[] {
  const [cpu, ram] = key.split('-').map(Number);
  return PRICES.providers
    .flatMap((provider) => {
      const plan = provider.plans[key];
      if (!plan || plan.monthly === null) return [];
      return [
        {
          ...plan,
          provider,
          monthly: plan.monthly,
          exact: plan.vcpu === cpu && plan.ramGb === ram,
        },
      ];
    })
    .sort((a, b) => ordering(a) - ordering(b));
}

/**
 * The plans the cards show: confirmed on the provider's own page, exactly the size, and not
 * an introductory offer. The first is the "from" line.
 */
export const cardOffers = (key: string) =>
  offersFor(key).filter((offer) => offer.verified && offer.exact && !offer.promo);

export const fromOffer = (key: string): Offer | undefined => cardOffers(key)[0];

/** The checked dates in the file, newest first. */
export const checkedDates = () =>
  [...new Set(PRICES.providers.map((provider) => provider.checked))].sort().reverse();

/** Whole days between a checked date and today. */
export const ageInDays = (checked: string, today: Date) =>
  Math.floor((today.getTime() - Date.parse(`${checked}T00:00:00Z`)) / 86_400_000);

export const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');

/**
 * Prices are dated facts about other companies' pages: each names its source, currency and
 * caveats, and the build fails once any was checked more than 90 days ago, so a stale price
 * never stays on the site unnoticed. Re-check the providers and update the dates to fix it.
 */
import { describe, expect, it } from 'vitest';
import { RECOMMENDED, sizeKey } from '../src/data/capacity.ts';
import {
  MAX_PRICE_AGE_DAYS,
  PRICES,
  ageInDays,
  cardOffers,
  fromOffer,
  money,
  offerMoney,
} from '../src/data/prices.ts';

describe('prices.json', () => {
  it.each(PRICES.providers.map((p) => [p.provider, p] as const))(
    '%s names its source, currency, checked date and caveats',
    (_, provider) => {
      expect(new URL(provider.url).protocol).toBe('https:');
      expect(['USD', 'EUR']).toContain(provider.currency);
      expect(provider.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(provider.caveats.length).toBeGreaterThan(20);
      expect(Object.keys(provider.plans).sort()).toEqual(['2-2', '2-4', '4-8']);
    },
  );

  it.each(PRICES.providers.map((p) => [p.provider, p.checked] as const))(
    '%s was checked within the last 90 days (re-check prices)',
    (_, checked) => {
      expect(ageInDays(checked, new Date())).toBeLessThanOrEqual(MAX_PRICE_AGE_DAYS);
    },
  );

  it('counts a price as stale on day 91', () => {
    const today = new Date('2026-10-12T12:00:00Z');
    expect(ageInDays('2026-10-12', today)).toBe(0);
    expect(ageInDays('2026-07-14', today)).toBe(90);
    expect(ageInDays('2026-07-13', today)).toBeGreaterThan(MAX_PRICE_AGE_DAYS);
  });
});

describe('the "from" line', () => {
  it('is Hetzner at €5.49, not an introductory offer', () => {
    const from = fromOffer(sizeKey(RECOMMENDED))!;
    expect(from.provider.provider).toBe('Hetzner');
    expect(offerMoney(from)).toBe('€5.49');
  });

  it('leaves out unverified, introductory and other-sized plans', () => {
    for (const offer of cardOffers(sizeKey(RECOMMENDED))) {
      expect(offer.verified).toBe(true);
      expect(offer.promo).toBeFalsy();
      expect([offer.vcpu, offer.ramGb]).toEqual([RECOMMENDED.cpu, RECOMMENDED.ramGb]);
    }
  });

  it('prints whole amounts without cents and keeps the currency', () => {
    expect(money(20, 'USD')).toBe('$20');
    expect(money(27.45, 'USD')).toBe('$27.45');
    expect(money(8.5, 'USD')).toBe('$8.50');
  });
});

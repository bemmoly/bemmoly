/**
 * Capacity numbers come only from src/data/capacity.json (run `pnpm build` first): the file
 * keeps its shape, a size being measured carries no numbers, and every number marked
 * data-capacity or data-price on /sizing and /self-hosting is a value in the file.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAPACITY, fmt, money } from '../src/data/capacity.ts';
import { parsePage } from './dom.ts';

const dist = new URL('../dist/', import.meta.url);

/** Every number in the JSON, as the page may print it (alone, formatted, or as a range). */
function allowed(): Set<string> {
  const numbers: number[] = [];
  const ranges: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'number') numbers.push(value);
    else if (Array.isArray(value)) {
      if (value.length === 2 && value.every((v) => typeof v === 'number'))
        ranges.push(`${fmt(value[0] as number)}–${fmt(value[1] as number)}`);
      value.forEach(walk);
    } else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(CAPACITY.sizes);
  return new Set([...numbers.flatMap((n) => [String(n), fmt(n)]), ...ranges]);
}

describe('capacity.json', () => {
  it('has the sizes the page shows, each measured or being measured', () => {
    expect(CAPACITY.sizes.map((s) => `${s.cpu}/${s.ramGb}`)).toEqual(['2/2', '2/4', '4/8']);
    for (const size of CAPACITY.sizes) {
      expect(['measured', 'measuring']).toContain(size.status);
      expect(size.prices.length).toBeGreaterThan(0);
      if (size.status === 'measuring') {
        expect([size.users, size.issues, size.docs, size.load]).toEqual([null, null, null, null]);
      }
    }
    expect(CAPACITY.sizes.filter((s) => s.recommended)).toHaveLength(1);
    expect(CAPACITY.priceNote).toMatch(/checked \w+ \d{4}, excluding storage, bandwidth and tax/);
  });
});

describe.each(['sizing.html', 'self-hosting.html'])('%s', (file) => {
  const page = parsePage(readFileSync(new URL(file, dist), 'utf8'));
  const values = allowed();
  const prices = new Set(CAPACITY.sizes.flatMap((s) => s.prices.map(money)));

  it('shows the three sizes', () => {
    expect(page.querySelectorAll('[data-size]')).toHaveLength(CAPACITY.sizes.length);
  });

  it('prints only capacity numbers that are in capacity.json', () => {
    const marked = page.querySelectorAll('[data-capacity]');
    expect(marked.length).toBeGreaterThan(0);
    for (const element of marked)
      expect(values, element.textContent).toContain(element.textContent.trim());
  });

  it('prints only prices that are in capacity.json', () => {
    for (const element of page.querySelectorAll('[data-price]')) {
      expect(prices).toContain(element.textContent.trim());
    }
  });

  it('puts no unmarked number on a size card', () => {
    for (const card of page.querySelectorAll('[data-size]')) {
      let text = card.textContent;
      for (const marked of card.querySelectorAll('[data-capacity], [data-price]')) {
        text = text.replace(marked.textContent, '');
      }
      // Only the card's own size label (vCPU and GB) may remain.
      text = text.replace(/\d+ vCPU, \d+ GB/, '');
      expect(text.match(/\d/g) ?? [], text).toEqual([]);
    }
  });
});

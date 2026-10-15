/**
 * Capacity numbers come only from the committed results file (run `pnpm build` first):
 * capacity.json's runs are that file's runs, a size with no runs carries no numbers, every
 * number in the sizing sections of /sizing and /self-hosting is a value in the data, every
 * people figure is computed from a measured load and sits beside the word "estimate", and a
 * run measured before the latest performance work shows the re-run note.
 */
import { readFileSync } from 'node:fs';
import { HtmlElement, type DOMNode } from 'html-validate';
import { describe, expect, it } from 'vitest';
import {
  CAPACITY,
  HEADLINE,
  LOAD_RUN,
  RECOMMENDED,
  floorRound,
  fmt,
  peopleOf,
} from '../src/data/capacity.ts';
import { AGENT_PROMPT } from '../src/data/agent-prompt.ts';
import { PRICES, money } from '../src/data/prices.ts';
import { SIZING } from '../src/data/self-hosting.ts';
import { parsePage } from './dom.ts';

const repo = new URL('../../../', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
const results = JSON.parse(readFileSync(new URL(CAPACITY.source, repo), 'utf8')) as {
  server: { cpu: number; ramGb: number };
  runs: unknown[];
};

/** Every number in the data, as the page may print it: alone, formatted, or as a range. */
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
  walk(CAPACITY);
  const { activeShare } = CAPACITY.assumption;
  // Shown as a percentage, and a 2,000 ms finding as seconds.
  const derived = [activeShare * 100, ...numbers.filter((n) => n >= 1000).map((n) => n / 1000)];
  return new Set([...[...numbers, ...derived].flatMap((n) => [String(n), fmt(n)]), ...ranges]);
}

describe('capacity.json', () => {
  it('copies its runs from the committed results file', () => {
    expect(results.server).toEqual({ cpu: RECOMMENDED.cpu, ramGb: RECOMMENDED.ramGb });
    expect(RECOMMENDED.runs).toEqual(results.runs);
  });

  it('lists the three sizes, one recommended, and only that one measured', () => {
    expect(CAPACITY.sizes.map((s) => `${s.cpu}/${s.ramGb}`)).toEqual(['2/2', '2/4', '4/8']);
    expect(CAPACITY.sizes.filter((s) => s.recommended)).toEqual([RECOMMENDED]);
    for (const size of CAPACITY.sizes.filter((s) => s !== RECOMMENDED))
      expect(size.runs).toEqual([]);
  });

  it('notes every run measured before the latest performance work', () => {
    for (const run of RECOMMENDED.runs.filter((r) => r.preliminary)) {
      expect(run.note).toBe('measured 2026-10-11 on 2 CPU/4 GB before perf fixes, pending re-run');
    }
  });

  it('headlines the largest data set that did not slow down', () => {
    expect(HEADLINE.data.issues).toBe(123_449);
    expect(HEADLINE.verdict).toBe('usable');
    expect(LOAD_RUN?.requestsPerSecond).toBe(80);
  });
});

describe('people estimate', () => {
  it('turns 80 requests a second into about 400 at once and teams of about 2,000', () => {
    expect(peopleOf(80)).toEqual({ atOnce: 400, organisation: 2000 });
  });

  it('rounds down, never up', () => {
    expect(peopleOf(93)).toEqual({ atOnce: 460, organisation: 2300 });
    expect(floorRound(399.9)).toBe(390);
    expect(floorRound(0)).toBe(0);
  });

  it('has nothing to say without a measured load', () => {
    expect(peopleOf(null)).toBeNull();
  });
});

const sizingSections = (file: string) => {
  const page = parsePage(readFileSync(new URL(file, dist), 'utf8'));
  return file === 'sizing.html' ? page.querySelectorAll('main') : page.querySelectorAll('#sizing');
};

describe.each(['sizing.html', 'self-hosting.html'])('%s', (file) => {
  const sections = sizingSections(file);
  const values = allowed();
  const prices = new Set(
    PRICES.providers.flatMap((p) =>
      Object.values(p.plans).flatMap((plan) =>
        plan === null
          ? []
          : [plan.monthly === null ? 'not published' : money(plan.monthly, p.currency)],
      ),
    ),
  );
  const PLAN_NAMES = new RegExp(
    PRICES.providers
      .flatMap((p) => Object.values(p.plans).flatMap((plan) => (plan ? [plan.plan] : [])))
      .join('|'),
    'g',
  );
  const all = (selector: string) => sections.flatMap((s) => s.querySelectorAll(selector));

  it('has the sizing answer', () => {
    expect(sections).toHaveLength(1);
    expect(all('[data-tier]')).toHaveLength(1);
    expect(all('[data-ladder] [data-size]')).toHaveLength(CAPACITY.sizes.length);
  });

  it('prints only capacity numbers that are in the data', () => {
    const marked = all('[data-capacity]');
    expect(marked.length).toBeGreaterThan(0);
    for (const element of marked)
      expect(values, element.textContent).toContain(element.textContent.trim());
  });

  it('prints only prices that are in prices.json', () => {
    const marked = all('[data-price]');
    expect(marked.length).toBeGreaterThan(0);
    for (const element of marked) expect(prices).toContain(element.textContent.trim());
  });

  it('computes every people figure from the measured load, labelled as an estimate', () => {
    const people = peopleOf(LOAD_RUN?.requestsPerSecond ?? null)!;
    const marked = all('[data-people]');
    expect(marked.length).toBeGreaterThan(0);
    for (const element of marked) {
      expect([fmt(people.atOnce), fmt(people.organisation)]).toContain(element.textContent.trim());
      let holder = element.parent;
      while (holder && !holder.hasAttribute('data-estimate')) holder = holder.parent;
      expect(holder?.textContent ?? '', 'a people figure outside an estimate').toMatch(/estimate/i);
    }
  });

  it('puts no number on the tier card that is not from the data', () => {
    const MARKED = ['data-capacity', 'data-price', 'data-people'];
    const unmarked = (node: DOMNode): string =>
      node instanceof HtmlElement
        ? MARKED.some((name) => node.hasAttribute(name))
          ? ' '
          : node.childNodes.map(unmarked).join('')
        : node.textContent;
    for (const card of all('[data-tier]')) {
      // Size labels (vCPU and GB), the "95% of requests" label and the checked date remain.
      const text = unmarked(card)
        .replace(/\d+ vCPU, \d+ GB/g, '')
        .replace(/95% of requests/g, '')
        .replace(/checked \d{4}-\d{2}-\d{2}/g, '')
        .replace(PLAN_NAMES, '');
      expect(text.match(/\d/g) ?? [], text).toEqual([]);
    }
  });

  it('says the numbers predate the latest performance work', () => {
    const note = all('[data-preliminary]');
    expect(note).toHaveLength(1);
    expect(note[0]!.textContent).toContain(
      'Measured before the latest performance work; re-run pending',
    );
  });
});

describe('the agent prompt and SIZING', () => {
  const values = allowed();
  const prices = new Set(
    PRICES.providers.flatMap((p) =>
      Object.values(p.plans).flatMap((plan) =>
        plan?.monthly == null ? [] : [money(plan.monthly, p.currency)],
      ),
    ),
  );

  it('lists every size, and no number for a size not measured', () => {
    expect(SIZING).toHaveLength(CAPACITY.sizes.length);
    CAPACITY.sizes.forEach((size, i) => {
      if (size.runs.length === 0)
        expect(SIZING[i]!.line).toMatch(/^\d+ vCPU, \d+ GB: not yet measured$/);
    });
  });

  it('prints only numbers from the data, and people only as an estimate', () => {
    for (const { line } of SIZING) {
      const text = line.replace(/^\d+ vCPU, \d+ GB/, '');
      for (const price of text.match(/[€$][\d.]+/g) ?? []) expect(prices).toContain(price);
      for (const n of text.replace(/[€$][\d.]+/g, '').match(/\d[\d,]*/g) ?? [])
        expect(values, line).toContain(n);
      if (/people/.test(line)) expect(line).toMatch(/people active at once \(an estimate/);
    }
  });

  it('puts the data sizing in the prompt, with no planning-figure claims', () => {
    for (const { line } of SIZING) expect(AGENT_PROMPT).toContain(line);
    expect(AGENT_PROMPT).not.toMatch(/Up to [\d,]+ people/);
  });
});

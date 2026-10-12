/**
 * The estimator recommends a size only where a run measured it, and otherwise says plainly
 * that the next size up is not yet measured. Checked against the real data and against
 * hand-made sizes, so the rule still holds when new runs land.
 */
import { describe, expect, it } from 'vitest';
import { CAPACITY, type Run, type ServerSize } from '../src/data/capacity.ts';
import {
  ISSUE_STOPS,
  PAGE_STOPS,
  coverageOf,
  estimate,
  explain,
  issuesText,
} from '../src/lib/estimate.ts';

const [small, medium, large] = CAPACITY.sizes as [ServerSize, ServerSize, ServerSize];

const run = (issues: number, verdict: Run['verdict'], docPages?: number): Run => ({
  id: `${issues}`,
  measured: '2026-10-11',
  preliminary: false,
  source: 'test',
  verdict,
  requestsPerSecond: null,
  data: { issues, docPages },
});

describe('with the published data', () => {
  it('recommends the measured 2 vCPU, 4 GB for 100,000 issues and 400 pages', () => {
    const result = estimate(CAPACITY.sizes, 100_000, 400);
    expect(result.size).toBe(medium);
    expect(result.measured).toBe(true);
    expect(explain(result)).toBe(
      'Measured: with about 100,000 issues it stayed usable. 2 vCPU, 2 GB is not yet measured, so it is not recommended.',
    );
  });

  it('never recommends the unmeasured 2 GB size, and says why', () => {
    const result = estimate(CAPACITY.sizes, 5_000, 100);
    expect(result.size).toBe(medium);
    expect(result.smallerUnmeasured).toEqual([small]);
    expect(explain(result)).toBe(
      'Measured: with 31,384 issues it ran fast at 80 requests a second. 2 vCPU, 2 GB is not yet measured, so it is not recommended.',
    );
  });

  it('says "not yet measured" past the slow run and names the next size', () => {
    const result = estimate(CAPACITY.sizes, 300_000, 400);
    expect(result).toMatchObject({ size: large, measured: false });
    expect(explain(result)).toBe(
      'At about 274,000 issues, 2 vCPU, 4 GB was measured slow. 4 vCPU, 8 GB is the next size up, and it is not yet measured.',
    );
  });

  it('says "not yet measured" between the usable and the slow run', () => {
    const result = estimate(CAPACITY.sizes, 150_000, 400);
    expect(result).toMatchObject({ size: large, measured: false });
    expect(explain(result)).toBe(
      '2 vCPU, 4 GB was measured up to 100,000 issues. 4 vCPU, 8 GB is the next size up, and it is not yet measured.',
    );
  });

  it('treats more doc pages than were measured as not measured', () => {
    const result = estimate(CAPACITY.sizes, 10_000, 1_000);
    expect(result).toMatchObject({ size: large, measured: false });
    expect(explain(result)).toContain('measured up to 400 doc pages');
  });

  it('starts its sliders on stops the page can show', () => {
    expect(ISSUE_STOPS).toContain(100_000);
    expect(PAGE_STOPS).toContain(400);
    expect([...ISSUE_STOPS].sort((a, b) => a - b)).toEqual([...ISSUE_STOPS]);
    expect(issuesText(100_000)).toBe('100,000 issues');
  });
});

describe('the rule', () => {
  const sizes = (...runs: Run[][]): ServerSize[] =>
    runs.map((r, i) => ({ cpu: 2 ** i, ramGb: 2 ** (i + 1), recommended: false, runs: r }));

  it('ignores slow runs when measuring how far a size reaches', () => {
    expect(coverageOf(sizes([run(10, 'fast', 5), run(50, 'slow', 90)])[0]!)).toEqual({
      issues: 10,
      pages: 5,
    });
    expect(coverageOf(sizes([])[0] ?? { cpu: 1, ramGb: 1, recommended: false, runs: [] })).toBe(
      null,
    );
  });

  it('picks the smallest measured size that covers the request', () => {
    const list = sizes([run(10, 'fast', 10)], [run(100, 'usable', 100)]);
    expect(estimate(list, 5, 5).size).toBe(list[0]);
    expect(estimate(list, 50, 5).size).toBe(list[1]);
  });

  it('has no size to offer beyond the largest one listed', () => {
    const list = sizes([run(10, 'fast', 10)]);
    const result = estimate(list, 50, 5);
    expect(result.size).toBeNull();
    expect(explain(result)).toBe(
      '1 vCPU, 2 GB was measured up to 10 issues. No larger size is listed yet.',
    );
  });
});

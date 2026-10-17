import { describe, expect, it } from 'vitest';
import { fingerprintOf, normaliseFailure } from './fingerprint.ts';
import { flips, isIntermittent, pushOutcome } from './flaky.ts';
import { splitByTiming } from './split.ts';

describe('failure fingerprints', () => {
  it('groups the same failure across hosts, ports, times and ids', () => {
    const a =
      'Error: connect ECONNREFUSED 10.4.1.7:5432 at 2026-10-16T09:10:02Z (job 1f2e3d4c5b6a)';
    const b =
      '\u001b[31mError: connect ECONNREFUSED 10.4.2.9:5433 at 2026-10-17T01:00:00Z (job 9a8b7c6d5e4f)\u001b[0m';
    expect(fingerprintOf(a)).toBe(fingerprintOf(b));
    expect(normaliseFailure(a)).toBe('Error: connect ECONNREFUSED <ip>:<n> at <time> (job <hex>)');
    expect(fingerprintOf('TypeError: x is undefined')).not.toBe(fingerprintOf(a));
    expect(fingerprintOf('')).toBeNull();
  });
});

describe('splitByTiming', () => {
  it('balances shards by past timings and gives every shard the same answer', () => {
    const timings = new Map([
      ['a.test.ts', 60_000],
      ['b.test.ts', 30_000],
      ['c.test.ts', 30_000],
      ['d.test.ts', 10_000],
      ['e.test.ts', 10_000],
      ['f.test.ts', 10_000],
    ]);
    const files = ['f.test.ts', 'e.test.ts', 'd.test.ts', 'c.test.ts', 'b.test.ts', 'a.test.ts'];
    const plan = splitByTiming(files, timings, 2);
    expect(plan.seconds).toEqual([80, 70]);
    expect(plan.files.flat().sort()).toEqual([...files].sort());
    expect(splitByTiming([...files].reverse(), timings, 2)).toEqual(plan);
  });

  it('counts files it has not timed as the median', () => {
    const plan = splitByTiming(['new.test.ts', 'old.test.ts'], new Map([['old.test.ts', 4000]]), 2);
    expect(plan.seconds).toEqual([4, 4]);
  });
});

describe('flaky outcomes', () => {
  it('keeps the last 50 outcomes and spots a test that keeps flipping', () => {
    let recent = '';
    for (let i = 0; i < 60; i += 1) recent = pushOutcome(recent, 'p');
    expect(recent).toHaveLength(50);
    expect(isIntermittent(recent)).toBe(false);
    expect(isIntermittent(`${recent.slice(0, 44)}pfpfpp`)).toBe(true);
    expect(flips('ppppff')).toBe(1);
    expect(isIntermittent('ppppff')).toBe(false);
  });
});

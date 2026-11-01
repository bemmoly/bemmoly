import { describe, expect, it } from 'vitest';
import { moveCost, runtimeMonthly, sizeOf } from './prices.ts';

/* A move plan's rough monthly prices: dated, marked as estimates, and like for like. */

describe('move prices', () => {
  it('read the size from the deploy settings, with Cloud Run’s defaults', () => {
    expect(sizeOf({})).toEqual({ cpu: 1, memoryGiB: 0.5 });
    expect(sizeOf({ deploy: { resources: { cpu: '500m', memory: '1Gi' } } })).toEqual({
      cpu: 0.5,
      memoryGiB: 1,
    });
    expect(sizeOf({ deploy: { resources: { cpu: 2, memory: '256Mi' } } })).toEqual({
      cpu: 2,
      memoryGiB: 0.25,
    });
  });

  it('price each runtime for the same size all month', () => {
    const size = { cpu: 1, memoryGiB: 0.5 };
    expect(runtimeMonthly('cloud-run', size)).toBe(49.93);
    expect(runtimeMonthly('gke-autopilot', size)).toBe(34.28);
    expect(runtimeMonthly('attached-cluster', size)).toBe(0);
  });

  it('show the front door and the cluster on both sides, changing nothing', () => {
    const cost = moveCost('cloud-run', 'gke-autopilot', { cpu: 1, memoryGiB: 0.5 });
    expect(cost).toMatchObject({ currency: 'USD', estimate: true, pricesAsOf: '2026-10-29' });
    expect(cost.lines).toEqual([
      { item: 'front-door', runtime: null, before: 18.25, after: 18.25 },
      { item: 'runtime', runtime: 'cloud-run', before: 49.93, after: 0 },
      { item: 'runtime', runtime: 'gke-autopilot', before: 0, after: 34.28 },
      { item: 'cluster', runtime: 'gke-autopilot', before: 73, after: 73 },
    ]);
    expect(cost.difference).toBe(-15.65);
  });
});

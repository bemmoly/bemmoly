import { describe, expect, it } from 'vitest';
import { slopePerHour, summarise, type SoakSample } from './summary.ts';

const MB = 1024 * 1024;

function sample(
  minute: number,
  rssMb: number,
  heapMb: number,
  p95: number,
  requests = 100,
  errors = 0,
): SoakSample {
  return {
    at: new Date(Date.UTC(2026, 9, 11, 12, minute)).toISOString(),
    rssBytes: rssMb * MB,
    heapUsedBytes: heapMb * MB,
    eventLoopLagP99Ms: 12,
    dbPool: { active: 2, idle: 4, max: 10, idleInTransaction: 0 },
    queueDepth: 0,
    busyQueues: {},
    websockets: 4,
    window: { requests, clientErrors: 0, serverErrors: errors, rateLimited: 0 },
    latencyMs: { p50: p95 / 2, p95, p99: p95 * 1.5 },
    dbConnections: 7,
    containers: null,
  };
}

describe('soak summary', () => {
  it('reads scheduled jobs as drained: only ready jobs are a backlog', () => {
    const samples = Array.from({ length: 10 }, (_, m) => ({
      ...sample(m, 300, 120, 40),
      queueDelayed: 200,
    }));
    expect(summarise(samples).verdicts.queuesDrained).toBe(true);
    const backlogged = [...samples.slice(0, -1), { ...samples.at(-1)!, queueDepth: 3 }];
    expect(summarise(backlogged).verdicts.queuesDrained).toBe(false);
  });

  it('fits a slope in units per hour', () => {
    expect(slopePerHour([0, 1, 2].map((h) => ({ hours: h, value: 100 + 10 * h })))).toBeCloseTo(10);
  });

  it('passes a steady run', () => {
    const samples = Array.from({ length: 60 }, (_, m) => sample(m, 300, 120, 40));
    expect(summarise(samples).verdicts).toEqual({
      nodeMemoryUnder512Mb: true,
      heapNotClimbing: true,
      p95DriftUnder25Percent: true,
      errorRateUnder1Percent: true,
      queuesDrained: true,
    });
  });

  it('flags a climbing heap, drifting p95, memory over budget and errors', () => {
    const samples = Array.from({ length: 60 }, (_, m) =>
      sample(m, 400 + m * 3, 100 + m, 40 + m, 100, 2),
    );
    const summary = summarise(samples);
    expect(summary.heapUsedMb.perHour).toBeCloseTo(60, 0);
    expect(summary.apiP95Ms.driftPercent).toBeGreaterThan(25);
    expect(summary.errorRatePercent).toBe(2);
    expect(summary.verdicts).toMatchObject({
      nodeMemoryUnder512Mb: false,
      heapNotClimbing: false,
      p95DriftUnder25Percent: false,
      errorRateUnder1Percent: false,
    });
  });
});

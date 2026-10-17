import { describe, expect, it } from 'vitest';
import { judgeMetric, nextFailingStreak, overallVerdict } from './judge.ts';
import { defaultPlan, narrowPlan, presentPlan, readPlan } from './plan.ts';
import { closesAt, isOpen, nextOpening, parseWindow } from './window.ts';

describe('canary judgement', () => {
  const sample = (value: number, requests = 500) => ({ value, requests });

  it('waits for enough requests before judging', () => {
    expect(judgeMetric('error_rate', sample(0.5, 3), sample(0)).verdict).toBe('pending');
    expect(judgeMetric('error_rate', null, sample(0)).verdict).toBe('pending');
  });

  it('passes a canary no worse than stable', () => {
    expect(judgeMetric('error_rate', sample(0.002), sample(0.002)).verdict).toBe('pass');
    expect(judgeMetric('latency_p95', sample(130), sample(120)).verdict).toBe('pass');
  });

  it('calls a small regression marginal and a large one a failure', () => {
    expect(judgeMetric('error_rate', sample(0.008), sample(0.002)).verdict).toBe('marginal');
    expect(judgeMetric('error_rate', sample(0.3), sample(0.002)).verdict).toBe('fail');
    expect(judgeMetric('latency_p95', sample(160), sample(120)).verdict).toBe('marginal');
    expect(judgeMetric('latency_p95', sample(400), sample(120)).verdict).toBe('fail');
  });

  it('uses absolute ceilings when there is no stable revision', () => {
    expect(judgeMetric('error_rate', sample(0.1), null).verdict).toBe('fail');
    expect(judgeMetric('error_rate', sample(0.03), null).verdict).toBe('marginal');
    expect(judgeMetric('error_rate', sample(0.001), null).verdict).toBe('pass');
  });

  it('takes the worst verdict and counts failures in a row', () => {
    const pass = judgeMetric('error_rate', sample(0.001), sample(0.001));
    const fail = judgeMetric('error_rate', sample(0.4), sample(0.001));
    const wait = judgeMetric('latency_p95', sample(100, 1), sample(100));
    expect(overallVerdict([pass, fail, wait])).toBe('fail');
    expect(overallVerdict([wait])).toBe('pending');
    expect(nextFailingStreak(nextFailingStreak(0, 'fail'), 'fail')).toBe(2);
    expect(nextFailingStreak(1, 'pending')).toBe(1);
    expect(nextFailingStreak(1, 'pass')).toBe(0);
  });
});

describe('deploy windows', () => {
  const window = parseWindow('Mon-Thu 10:00-16:00 Asia/Kolkata');

  it('is open on a weekday afternoon in its own time zone', () => {
    // Tuesday 14:00 in Kolkata is 08:30 UTC.
    expect(isOpen(window, new Date('2026-10-13T08:30:00Z'))).toBe(true);
    expect(closesAt(window, new Date('2026-10-13T08:30:00Z')).toISOString()).toBe(
      '2026-10-13T10:30:00.000Z',
    );
    // Friday is outside Mon-Thu.
    expect(isOpen(window, new Date('2026-10-16T08:30:00Z'))).toBe(false);
  });

  it('finds the next opening across a weekend', () => {
    // Friday 14:00 Kolkata: next is Monday 10:00 Kolkata, 04:30 UTC.
    expect(nextOpening(window, new Date('2026-10-16T08:30:00Z'))?.toISOString()).toBe(
      '2026-10-19T04:30:00.000Z',
    );
  });

  it('reads day lists and refuses nonsense', () => {
    const listed = parseWindow('Mon,Wed 09:00-17:00 UTC');
    expect([...listed.days].sort()).toEqual([1, 3]);
    expect(() => parseWindow('Someday 10:00-16:00 UTC')).toThrow();
    expect(() => parseWindow('Mon 16:00-10:00 UTC')).toThrow();
    expect(() => parseWindow('Mon 10:00-16:00 Mars/Olympus')).toThrow();
  });
});

describe('rollout plans', () => {
  const stages = [
    { stage: 2, bakeMinutes: 0, environments: ['prod-asia-south1'] },
    { stage: 3, bakeMinutes: 30, environments: ['prod-us-east1', 'prod-eu-west1'] },
  ];
  const defaults = { holdMinutes: 10, watchMinutes: 10, sampleSeconds: 60 };

  it('canaries the first Prod region by tier and bakes the rest', () => {
    const plan = defaultPlan({ tier: 1, environmentClass: 'prod', stages, defaults });
    expect(plan.waves).toEqual([
      expect.objectContaining({ wave: 1, steps: [5, 25, 100], holdMinutes: 10 }),
      expect.objectContaining({ wave: 2, steps: [], startsAfterMinutes: 30 }),
    ]);
    const staging = defaultPlan({
      tier: 0,
      environmentClass: 'staging',
      stages: [{ stage: 1, bakeMinutes: 0, environments: ['staging'] }],
      defaults,
    });
    expect(staging.waves[0]?.steps).toEqual([]);
  });

  it('accepts a more careful plan and refuses a less careful one', () => {
    const plan = defaultPlan({ tier: 1, environmentClass: 'prod', stages, defaults });
    const env = {
      id: '00000000-0000-7000-8000-000000000001',
      key: 'prod-asia-south1',
      name: 'Asia',
      class: 'prod' as const,
    };
    const careful = narrowPlan(plan, {
      waves: [
        {
          wave: 1,
          environments: [env],
          steps: [1, 5, 25, 100].map((trafficPercent) => ({ trafficPercent, holdMinutes: 20 })),
          startsAfter: null,
          checks: ['error_rate'],
        },
      ],
    });
    expect(careful.waves[0]?.steps).toEqual([1, 5, 25, 100]);
    expect(() => narrowPlan(plan, { autoRollback: false })).toThrow(/never less/);
    expect(() =>
      narrowPlan(plan, {
        waves: [
          {
            wave: 1,
            environments: [env],
            steps: [{ trafficPercent: 100, holdMinutes: 0 }],
            startsAfter: null,
            checks: [],
          },
        ],
      }),
    ).toThrow(/canary steps/);
  });

  it('reads the seeded plan shape and presents it with environment refs', () => {
    const stored = readPlan({
      waves: [
        { wave: 1, environments: ['prod-asia-south1'], steps: [5, 25, 100], holdMinutes: 10 },
        { wave: 2, environments: ['prod-us-east1', 'gone'], startsAfterMinutes: 30 },
      ],
      autoRollback: true,
    });
    const refs = new Map(
      ['prod-asia-south1', 'prod-us-east1'].map((key, i) => [
        key,
        { id: `00000000-0000-7000-8000-00000000000${i}`, key, name: key, class: 'prod' as const },
      ]),
    );
    const shown = presentPlan(stored, refs);
    expect(shown.waves[1]?.environments.map((e) => e.key)).toEqual(['prod-us-east1']);
    expect(shown.waves[1]?.startsAfter).toEqual({ wave: 1, bakeMinutes: 30 });
    expect(shown.waves[0]?.steps[0]).toEqual({ trafficPercent: 5, holdMinutes: 10 });
  });
});

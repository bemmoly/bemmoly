import { describe, expect, it } from 'vitest';
import { toDay } from './days.ts';
import { dependencyOrder, forecastAll, type ForecastProject } from './forecast.ts';
import { epic, QUIET, SPRINTING, STEADY, TODAY, UNEVEN } from './forecast-fixtures.ts';

const run = (
  items: Parameters<typeof forecastAll>[0],
  projects: Record<string, ForecastProject> = { plt: STEADY },
  dependencies: { fromId: string; toId: string }[] = [],
) =>
  forecastAll(items, { today: TODAY, projects: new Map(Object.entries(projects)), dependencies });

describe('forecastAll on a steady team', () => {
  it('lands twelve issues three weeks out at four a week, on track for a later target', () => {
    const forecast = run([epic({ id: 'auth', targetDay: toDay('2026-10-30') })]).get('auth');
    expect(forecast).toMatchObject({
      state: 'on_track',
      basis: 'throughput',
      likely: '2026-10-26',
      earliest: '2026-10-26',
      latest: '2026-10-26',
      daysLate: -4,
      confidence: 'high',
    });
    expect(forecast?.explanation).toEqual([
      'Over the last 8 weeks, Platform Core finished 4 issues every week.',
      '12 of its 12 issues are left.',
      'Replaying those weeks a thousand times, half the runs finish by Oct 26 and 85 in 100 by Oct 26.',
      'Even the slower runs finish by the Oct 30 target, 4 days early.',
      'Confidence is high: the pace has been steady.',
    ]);
  });

  it('counts the days late against the target', () => {
    const forecast = run([epic({ id: 'billing', targetDay: toDay('2026-10-15') })]).get('billing');
    expect(forecast).toMatchObject({ state: 'late', daysLate: 11, likely: '2026-10-26' });
    expect(forecast?.explanation).toContain('That is 11 days after the Oct 15 target.');
  });

  it('gives a third of the pace to each of three epics in flight', () => {
    const forecast = run([epic({ id: 'auth', sharedWith: 2 })]).get('auth');
    expect(forecast).toMatchObject({ state: 'no_target', likely: '2026-12-07' });
    expect(forecast?.explanation).toContain(
      'The team is working on 3 epics at once, so this one gets a third of that pace.',
    );
  });

  it('starts waiting work when its blocker lands, and lets begun work finish no earlier', () => {
    const forecasts = run(
      [
        epic({ id: 'observability', title: 'Observability', started: false, remainingIssues: 8 }),
        epic({ id: 'billing', title: 'Billing v2' }),
        epic({ id: 'pricing', title: 'Usage pricing', remainingIssues: 4 }),
      ],
      { plt: STEADY },
      [
        { fromId: 'billing', toId: 'observability' },
        { fromId: 'billing', toId: 'pricing' },
      ],
    );
    expect(forecasts.get('billing')?.likely).toBe('2026-10-26');
    expect(forecasts.get('observability')).toMatchObject({
      likely: '2026-11-09',
      waitsOn: ['billing'],
    });
    expect(forecasts.get('observability')?.explanation).toContain(
      'It starts once Billing v2 is done, likely Oct 26.',
    );
    // A week of its own work, but it cannot finish before Billing v2.
    expect(forecasts.get('pricing')?.likely).toBe('2026-10-26');
    expect(forecasts.get('pricing')?.explanation).toContain(
      'It cannot finish before Billing v2, likely done Oct 26.',
    );
  });

  it('waits for a future start date before work begins', () => {
    const later = epic({ id: 'soc2', started: false, startDay: toDay('2026-11-02') });
    expect(run([later]).get('soc2')?.likely).toBe('2026-11-23');
  });

  it('ignores the links of a dependency cycle', () => {
    const forecasts = run([epic({ id: 'a' }), epic({ id: 'b' })], { plt: STEADY }, [
      { fromId: 'a', toId: 'b' },
      { fromId: 'b', toId: 'a' },
    ]);
    expect(forecasts.get('a')).toMatchObject({ likely: '2026-10-26', waitsOn: [] });
    expect(forecasts.get('b')).toMatchObject({ likely: '2026-10-26', waitsOn: [] });
  });
});

describe('forecastAll on the other fixture teams', () => {
  it('pins the uneven team’s range, at risk against its target', () => {
    const forecast = run(
      [epic({ id: 'SUP-12', projectId: 'sup', remainingIssues: 20, totalIssues: 26 })],
      { sup: UNEVEN },
    ).get('SUP-12');
    expect(forecast).toMatchObject({
      earliest: '2026-11-01',
      likely: '2026-11-09',
      latest: '2026-11-20',
      confidence: 'medium',
    });
    const atRisk = run(
      [
        epic({
          id: 'SUP-12',
          projectId: 'sup',
          remainingIssues: 20,
          totalIssues: 26,
          targetDay: toDay('2026-11-12'),
        }),
      ],
      { sup: UNEVEN },
    ).get('SUP-12');
    expect(atRisk).toMatchObject({ state: 'at_risk', daysLate: -3 });
    expect(atRisk?.explanation).toContain(
      'That meets the Nov 12 target, but the slower runs miss it.',
    );
  });

  it('forecasts in points from velocity, counting unestimated issues at the mean', () => {
    const forecast = run(
      [
        epic({
          id: 'BIL-1',
          projectId: 'bil',
          remainingIssues: 12,
          remainingPoints: 32,
          unestimated: 2,
        }),
      ],
      { bil: SPRINTING },
    ).get('BIL-1');
    expect(forecast).toMatchObject({ basis: 'velocity', remainingPoints: 40 });
    expect(forecast?.likely).toBe('2026-11-02');
    expect(forecast?.explanation[1]).toBe(
      '40 points are left in 12 open issues, counting the 2 issues without an estimate at 4 points each, the project’s average.',
    );
  });

  it('says plainly when there is too little history', () => {
    const forecast = run([epic({ id: 'r', projectId: 'res' })], { res: QUIET }).get('r');
    expect(forecast).toMatchObject({ state: 'no_forecast', likely: null, confidence: null });
    expect(forecast?.explanation).toEqual([
      'Not enough finished work to forecast yet: Research finished 1 issue in the last 8 weeks, and a forecast needs 3 or more.',
    ]);
  });

  it('marks done and empty items without dates', () => {
    const forecasts = run([
      epic({ id: 'done', done: true }),
      epic({ id: 'empty', totalIssues: 0, remainingIssues: 0 }),
      { ...epic({ id: 'v1', kind: 'version' }), totalIssues: 0, remainingIssues: 0 },
    ]);
    expect(forecasts.get('done')).toMatchObject({ state: 'done', likely: null });
    expect(forecasts.get('empty')?.explanation).toEqual([
      'No issues are in it yet, so there is nothing to forecast.',
    ]);
    expect(forecasts.get('v1')?.explanation).toEqual([
      'No issues name this version yet, so there is nothing to forecast.',
    ]);
  });

  it('calls an epic with every issue done ready to close, landing today', () => {
    const forecast = run([epic({ id: 'ready', remainingIssues: 0, targetDay: TODAY })]).get(
      'ready',
    );
    expect(forecast).toMatchObject({ state: 'on_track', likely: '2026-10-05', daysLate: 0 });
    expect(forecast?.explanation).toContain('Every issue in it is done; it is ready to close.');
  });

  it('refuses a forecast past the horizon', () => {
    const forecast = run([epic({ id: 'huge', remainingIssues: 5000, totalIssues: 5000 })]).get(
      'huge',
    );
    expect(forecast).toMatchObject({ state: 'no_forecast', likely: null });
  });
});

describe('dependencyOrder', () => {
  it('puts blockers first and keeps list order otherwise', () => {
    expect(
      dependencyOrder(
        ['c', 'b', 'a'],
        [
          { fromId: 'a', toId: 'b' },
          { fromId: 'x', toId: 'c' },
        ],
      ).order,
    ).toEqual(['c', 'a', 'b']);
  });
});

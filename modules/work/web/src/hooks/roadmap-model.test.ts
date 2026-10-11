import { dayOfIso, isoOfDay, timelineScale } from '@bemmoly/ui';
import { describe, expect, it } from 'vitest';
import { IDS, item, roadmapView } from '../roadmap/fixtures.test-helper.ts';
import { stripWords, slipping } from '../roadmap/forecast-strip.tsx';
import { barDates, dependencyLines, placeBar } from './roadmap-bars.ts';
import {
  roadmapRows,
  roadmapSpan,
  rowTops,
  visibleItems,
  type RoadmapFilters,
} from './roadmap-model.ts';
import { shiftDates, withDates } from './roadmap-schedule.ts';

const ALL: RoadmapFilters = { q: '', versions: true, done: false, teamId: null };
const today = dayOfIso('2026-10-05');

describe('roadmap rows', () => {
  it('hides done items and versions on request, and filters by words and team', () => {
    const view = roadmapView();
    const titles = (filters: typeof ALL) => visibleItems(view, filters).map((entry) => entry.title);
    expect(titles(ALL)).toEqual([
      'Billing v2',
      'Auth service',
      'Observability',
      '1.4',
      'Offline mode',
    ]);
    expect(titles({ ...ALL, versions: false, done: true })).toContain('Self-serve onboarding');
    expect(titles({ ...ALL, versions: false })).not.toContain('1.4');
    expect(titles({ ...ALL, q: 'plt-19' })).toEqual(['Auth service']);
    expect(titles({ ...ALL, teamId: IDS.mobile })).toEqual(['Offline mode']);
  });

  it('groups by project or team, opens epics to their issues and folds groups', () => {
    const view = roadmapView();
    const items = visibleItems(view, ALL);
    const byProject = roadmapRows(view, items, 'project', new Set([IDS.auth]), new Set());
    expect(byProject.map((row) => row.kind)).toEqual([
      'group',
      'item',
      'item',
      'child',
      'child',
      'item',
      'item',
      'group',
      'item',
    ]);
    const folded = roadmapRows(view, items, 'team', new Set(), new Set([`team:${IDS.mobile}`]));
    expect(
      folded
        .filter((row) => row.kind === 'group')
        .map((row) => row.kind === 'group' && [row.label, row.open]),
    ).toEqual([
      ['Mobile', false],
      ['Platform', true],
    ]);
    expect(roadmapRows(view, items, 'none', new Set(), new Set())[0]?.kind).toBe('item');
    expect(rowTops(byProject).height).toBe(32 * 2 + 44 * 5 + 32 * 2);
  });

  it('covers every bar and forecast with room either side', () => {
    const span = roadmapSpan(roadmapView().items, today);
    expect(isoOfDay(span.from)).toBe('2026-08-25');
    expect(isoOfDay(span.to)).toBe('2027-01-20');
  });
});

describe('roadmap bars', () => {
  const scale = timelineScale('months', dayOfIso('2026-09-01'), dayOfIso('2026-12-31'));

  it('runs from start to the end of the target day, with the late stretch to the forecast', () => {
    const billing = roadmapView().items[0]!;
    const place = placeBar(billing, scale, today);
    expect(place).toMatchObject({ left: 21 * 6, width: 30 * 6, ghost: false, openStart: false });
    expect(place?.late).toEqual({ width: 11 * 6, label: 'Forecast Nov 1' });
    expect(place?.range?.warn).toBe(true);
  });

  it('fades in a bar without a start and outlines one without a target', () => {
    expect(
      barDates(item({ id: 'a', title: 'A', start: null, startAt: null }), today),
    ).toMatchObject({
      openStart: true,
      start: dayOfIso('2026-10-05'),
    });
    const noTarget = item({ id: 'b', title: 'B', end: null, endAt: null });
    expect(barDates(noTarget, today)).toMatchObject({ ghost: true, end: dayOfIso('2026-10-20') });
    expect(
      barDates(
        item({
          id: 'c',
          title: 'C',
          start: null,
          end: null,
          forecast: { ...noTarget.forecast, likely: null },
        }),
        today,
      ),
    ).toBeNull();
  });

  it('draws a dependency from the blocker’s end, amber when the waiting item starts first', () => {
    const view = roadmapView();
    const rows = roadmapRows(view, visibleItems(view, ALL), 'none', new Set(), new Set());
    const bars = new Map(
      view.items.flatMap((entry) => {
        const place = placeBar(entry, scale, today);
        return place ? [[entry.id, place] as const] : [];
      }),
    );
    const [line] = dependencyLines(view.dependencies, rows, rowTops(rows).tops, bars);
    expect(line).toMatchObject({
      from: { x: 21 * 6 + 30 * 6, y: 22 },
      to: { y: 2 * 44 + 22 },
      conflict: false,
    });
  });
});

describe('rescheduling', () => {
  const dates = { start: 100, end: 120 };

  it('moves both ends, or one end without passing the other', () => {
    expect(shiftDates(dates, 'move', 7)).toEqual({ start: 107, end: 127 });
    expect(shiftDates(dates, 'start', 30)).toEqual({ start: 120, end: 120 });
    expect(shiftDates(dates, 'end', -3)).toEqual({ start: 100, end: 117 });
  });

  it('writes the new dates into every cached roadmap', () => {
    const moved = withDates(roadmapView(), IDS.billing, {
      start: dayOfIso('2026-09-29'),
      end: dayOfIso('2026-10-28'),
    });
    expect(moved.items[0]).toMatchObject({
      startAt: '2026-09-29',
      start: '2026-09-29',
      endAt: '2026-10-28',
    });
  });
});

describe('the forecast strip', () => {
  it('names the latest item and what waits on it, or stays away when nothing slips', () => {
    const view = roadmapView();
    const late = slipping(view.items);
    expect(late?.title).toBe('Billing v2');
    expect(stripWords(late!, 1, 0, today)).toBe(
      'Billing v2 is likely 11 days past its Oct 21 target. 1 item waits on it.',
    );
    expect(slipping(view.items.filter((entry) => entry.id !== IDS.billing))).toBeNull();
  });
});

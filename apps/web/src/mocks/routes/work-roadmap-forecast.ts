/*
 * The roadmap's forecast in the mock backend: the same idea as the server's
 * (modules/work/server/src/services/roadmap; apps never import a module), shortened. Each
 * epic replays its project's weekly throughput a few hundred times from a seeded generator,
 * shares the team with the other epics in flight, and starts when the epic it waits on lands.
 */

const DAY = 86_400_000;
const TRIALS = 1000;
const HORIZON = 156;

export interface MockForecastItem {
  id: string;
  kind: 'epic' | 'version';
  title: string;
  done: boolean;
  total: number;
  remaining: number;
  started: boolean;
  startDay: number | null;
  targetDay: number | null;
  sharedWith: number;
  project: string;
  samples: readonly number[] | undefined;
}

export interface MockForecast {
  state: 'done' | 'on_track' | 'at_risk' | 'late' | 'no_target' | 'no_forecast' | 'no_work';
  basis: 'throughput' | null;
  remainingIssues: number;
  remainingPoints: null;
  likely: string | null;
  earliest: string | null;
  latest: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  daysLate: number | null;
  waitsOn: string[];
  explanation: string[];
}

type Ends = [number, number, number];

export const dayOf = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY);
const isoOf = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
const words = (day: number) =>
  new Date(day * DAY).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

function random(seed: string) {
  let state = [...seed].reduce(
    (h, c) => Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0,
    2166136261,
  );
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Weeks until done at the 15th, 50th and 85th percentile; null past the horizon. */
function weeks(remaining: number, samples: readonly number[], share: number, seed: string) {
  const next = random(seed);
  const runs = Array.from({ length: TRIALS }, () => {
    let left = remaining;
    for (let week = 0; week < HORIZON; week += 1) {
      const pace = (samples[Math.floor(next() * samples.length)] ?? 0) * share;
      if (pace >= left) return week + left / pace;
      left -= pace;
    }
    return Infinity;
  }).sort((a, b) => a - b);
  const at = (p: number) => runs[Math.ceil(p * TRIALS) - 1] ?? Infinity;
  const ends: Ends = [at(0.15), at(0.5), at(0.85)];
  return Number.isFinite(ends[2]) ? ends : null;
}

const blank = (item: MockForecastItem, state: MockForecast['state'], explanation: string[]) => ({
  state,
  basis: null,
  remainingIssues: item.remaining,
  remainingPoints: null,
  likely: null,
  earliest: null,
  latest: null,
  confidence: null,
  daysLate: null,
  waitsOn: [],
  explanation,
});

export function mockForecast(
  item: MockForecastItem,
  blockers: ReadonlyArray<{ id: string; title: string; ends: Ends }>,
  today: number,
): { forecast: MockForecast; ends: Ends | null } {
  if (item.done)
    return {
      forecast: blank(item, 'done', [
        item.kind === 'epic' ? 'Every issue in it is done.' : 'Released.',
      ]),
      ends: null,
    };
  if (item.total === 0)
    return {
      forecast: blank(item, 'no_work', [
        'No issues are in it yet, so there is nothing to forecast.',
      ]),
      ends: null,
    };
  const samples = item.samples;
  if (!samples)
    return {
      forecast: blank(item, 'no_forecast', [
        `Not enough finished work to forecast yet: ${item.project} has no finished issues in the last 8 weeks.`,
      ]),
      ends: null,
    };
  const spread = weeks(item.remaining, samples, 1 / (item.sharedWith + 1), item.id);
  if (!spread)
    return { forecast: blank(item, 'no_forecast', ['Too far to forecast.']), ends: null };
  const begin = item.started ? today : Math.max(today, item.startDay ?? today);
  const ends = spread.map((week, index) => {
    const after = Math.max(-Infinity, ...blockers.map((blocker) => blocker.ends[index] ?? 0));
    const length = Math.ceil(week * 7);
    return item.started ? Math.max(begin + length, after) : Math.max(begin, after) + length;
  }) as Ends;
  const [earliest, likely, latest] = ends;
  const target = item.targetDay;
  const state =
    target === null
      ? 'no_target'
      : latest <= target
        ? 'on_track'
        : likely <= target
          ? 'at_risk'
          : 'late';
  const low = Math.min(...samples);
  const high = Math.max(...samples);
  const mean = Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10;
  const explanation = [
    `Over the last ${samples.length} weeks, ${item.project} finished ${low} to ${high} issues a week, ${mean} on average.`,
    `${item.remaining} of its ${item.total} issues are left.`,
    ...(item.sharedWith > 0
      ? [
          `The team is working on ${item.sharedWith + 1} epics at once, so this one gets ${item.sharedWith === 1 ? 'half' : 'a third'} of that pace.`,
        ]
      : []),
    ...blockers.map((blocker) =>
      item.started
        ? `It cannot finish before ${blocker.title}, likely done ${words(blocker.ends[1])}.`
        : `It starts once ${blocker.title} is done, likely ${words(blocker.ends[1])}.`,
    ),
    `Replaying those weeks a thousand times, half the runs finish by ${words(likely)} and 85 in 100 by ${words(latest)}.`,
    target === null
      ? 'It has no target date to compare with.'
      : state === 'late'
        ? `That is ${days(likely - target)} after the ${words(target)} target.`
        : state === 'at_risk'
          ? `That meets the ${words(target)} target, but the slower runs miss it.`
          : `Even the slower runs finish by the ${words(target)} target.`,
    'Confidence is medium: the pace swings from week to week.',
  ];
  return {
    ends,
    forecast: {
      state,
      basis: 'throughput',
      remainingIssues: item.remaining,
      remainingPoints: null,
      likely: isoOf(likely),
      earliest: isoOf(earliest),
      latest: isoOf(latest),
      confidence: 'medium',
      daysLate: target === null ? null : likely - target,
      waitsOn: blockers.map((blocker) => blocker.id),
      explanation,
    },
  };
}

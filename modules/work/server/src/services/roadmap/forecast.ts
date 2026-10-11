import type { Forecast, ForecastState } from '../../../../shared/roadmap.ts';
import { fromDay } from './days.ts';
import {
  explainDone,
  explainForecast,
  explainHorizon,
  explainNoHistory,
  explainNoWork,
} from './explain.ts';
import { steadiness, type ProjectHistory } from './history.ts';
import { simulate } from './simulate.ts';

/*
 * When each epic and version lands. Items are forecast in dependency order, so an item that
 * waits on another starts (or, once begun, can finish) no earlier than that one's forecast
 * at the same percentile: the likely date follows the blocker's likely date, the range its
 * range. A dependency cycle cannot be ordered; its links are left out of the arithmetic.
 */

export interface ForecastItem {
  id: string;
  kind: 'epic' | 'version';
  projectId: string;
  title: string;
  done: boolean;
  totalIssues: number;
  remainingIssues: number;
  /** Estimated points left; unestimated issues are counted separately. */
  remainingPoints: number;
  unestimated: number;
  /** Work has begun: an issue in it moved past to do, or its start date has come. */
  started: boolean;
  startDay: number | null;
  targetDay: number | null;
  /** Other items of the project worked on at the same time, sharing the team's pace. */
  sharedWith: number;
}

export interface ForecastProject extends ProjectHistory {
  name: string;
}

export interface Ends {
  earliest: number;
  likely: number;
  latest: number;
}

export interface ForecastContext {
  today: number;
  projects: ReadonlyMap<string, ForecastProject>;
  /** `fromId` blocks `toId`. */
  dependencies: readonly { fromId: string; toId: string }[];
}

const PERCENTILES = ['earliest', 'likely', 'latest'] as const;

/** Items in an order where every blocker comes before what it blocks; cycles keep list order. */
export function dependencyOrder(
  ids: readonly string[],
  dependencies: ForecastContext['dependencies'],
): { order: string[]; blockers: Map<string, string[]> } {
  const known = new Set(ids);
  const edges = dependencies.filter((edge) => known.has(edge.fromId) && known.has(edge.toId));
  const waiting = new Map(ids.map((id) => [id, 0]));
  for (const edge of edges) waiting.set(edge.toId, (waiting.get(edge.toId) ?? 0) + 1);
  const order: string[] = [];
  const ready = ids.filter((id) => waiting.get(id) === 0);
  while (ready.length > 0) {
    const id = ready.shift() as string;
    order.push(id);
    for (const edge of edges.filter((candidate) => candidate.fromId === id)) {
      const left = (waiting.get(edge.toId) ?? 0) - 1;
      waiting.set(edge.toId, left);
      if (left === 0) ready.push(edge.toId);
    }
  }
  const placed = new Set(order);
  const blockers = new Map<string, string[]>();
  for (const edge of edges) {
    // A link inside a cycle never resolved; it is not followed.
    if (!placed.has(edge.toId) || !placed.has(edge.fromId)) continue;
    blockers.set(edge.toId, [...(blockers.get(edge.toId) ?? []), edge.fromId]);
  }
  return { order: [...order, ...ids.filter((id) => !placed.has(id))], blockers };
}

function blank(item: ForecastItem, state: ForecastState, explanation: string[]): Forecast {
  return {
    state,
    basis: null,
    remainingIssues: item.remainingIssues,
    remainingPoints: null,
    likely: null,
    earliest: null,
    latest: null,
    confidence: null,
    daysLate: null,
    waitsOn: [],
    explanation,
  };
}

function stateOf(ends: Ends, targetDay: number | null): ForecastState {
  if (targetDay === null) return 'no_target';
  if (ends.latest <= targetDay) return 'on_track';
  if (ends.likely <= targetDay) return 'at_risk';
  return 'late';
}

interface Done {
  forecast: Forecast;
  ends: Ends | null;
}

function forecastOne(
  item: ForecastItem,
  project: ForecastProject | undefined,
  blockers: readonly { item: ForecastItem; ends: Ends }[],
  today: number,
): Done {
  if (item.done) return { forecast: blank(item, 'done', explainDone(item.kind)), ends: null };
  if (item.totalIssues === 0)
    return { forecast: blank(item, 'no_work', explainNoWork(item.kind)), ends: null };
  const history = project?.history;
  if (!project || !history) {
    const why = explainNoHistory(project?.name ?? 'The project', project?.completions ?? 0);
    return { forecast: blank(item, 'no_forecast', why), ends: null };
  }
  const velocity = history.basis === 'velocity';
  const points = item.remainingPoints + item.unestimated * project.meanEstimate;
  const remaining = velocity ? points : item.remainingIssues;
  const sim = simulate({
    remaining,
    samples: history.samples,
    share: 1 / (item.sharedWith + 1),
    seed: item.id,
  });
  if (!sim || !Number.isFinite(sim.latest)) {
    return { forecast: blank(item, 'no_forecast', explainHorizon(project.name)), ends: null };
  }
  const begin = item.started ? today : Math.max(today, item.startDay ?? today);
  const ends = {} as Ends;
  for (const p of PERCENTILES) {
    const duration = Math.ceil(sim[p] * history.periodDays);
    const after = Math.max(-Infinity, ...blockers.map((blocker) => blocker.ends[p]));
    ends[p] = item.started ? Math.max(begin + duration, after) : Math.max(begin, after) + duration;
  }
  const state = stateOf(ends, item.targetDay);
  const steady = steadiness(history.samples);
  return {
    ends,
    forecast: {
      state,
      basis: history.basis,
      remainingIssues: item.remainingIssues,
      remainingPoints: velocity ? Math.round(points * 10) / 10 : null,
      likely: fromDay(ends.likely),
      earliest: fromDay(ends.earliest),
      latest: fromDay(ends.latest),
      confidence: steady.confidence,
      daysLate: item.targetDay === null ? null : ends.likely - item.targetDay,
      waitsOn: blockers.map((blocker) => blocker.item.id),
      explanation: explainForecast({
        kind: item.kind,
        project: project.name,
        history,
        totalIssues: item.totalIssues,
        remainingIssues: item.remainingIssues,
        remainingPoints: Math.round(points * 10) / 10,
        unestimated: item.unestimated,
        meanEstimate: project.meanEstimate,
        sharedWith: item.sharedWith,
        started: item.started,
        blockers: blockers.map((blocker) => ({
          title: blocker.item.title,
          likely: blocker.ends.likely,
        })),
        ends,
        state,
        targetDay: item.targetDay,
        steadiness: steady,
        working: history.samples.filter((sample) => sample > 0).length,
        today,
      }),
    },
  };
}

/** Every item's forecast, by id. */
export function forecastAll(
  items: readonly ForecastItem[],
  context: ForecastContext,
): Map<string, Forecast> {
  const byId = new Map(items.map((item) => [item.id, item]));
  const { order, blockers } = dependencyOrder(
    items.map((item) => item.id),
    context.dependencies,
  );
  const ends = new Map<string, Ends>();
  const forecasts = new Map<string, Forecast>();
  for (const id of order) {
    const item = byId.get(id);
    if (!item) continue;
    const before = (blockers.get(id) ?? []).flatMap((blockerId) => {
      const blocker = byId.get(blockerId);
      const at = ends.get(blockerId);
      return blocker && at ? [{ item: blocker, ends: at }] : [];
    });
    const result = forecastOne(item, context.projects.get(item.projectId), before, context.today);
    forecasts.set(id, result.forecast);
    if (result.ends) ends.set(id, result.ends);
  }
  return forecasts;
}

import type { RoadmapChild, RoadmapItem } from '@bemmoly/module-work/shared';
import {
  dayOfIso,
  shortDate,
  yearOfDay,
  type DependencyLine,
  type TimelineScale,
} from '@bemmoly/ui';
import { ROW_HEIGHT, type RoadmapRow } from './roadmap-model.ts';

/*
 * Where each bar sits on the axis. A bar runs from its start to the end of its target day;
 * without a stored start it fades in from two weeks before the target (or today), without a
 * target it is a dashed outline to the likely day. Past the target, the late stretch reaches
 * the likely day; the whisker spans the forecast range.
 */

export interface Dates {
  start: number;
  end: number;
}

export interface BarPlace {
  dates: Dates;
  left: number;
  width: number;
  openStart: boolean;
  ghost: boolean;
  late: { width: number; label: string } | null;
  range: { from: number; likely: number; to: number; warn: boolean } | null;
}

const day = (iso: string | null) => (iso ? dayOfIso(iso) : null);

/** The days a bar covers, or null when the item has nothing to draw. */
export function barDates(
  item: RoadmapItem,
  today: number,
): (Dates & { openStart: boolean; ghost: boolean }) | null {
  const start = day(item.start);
  const end = day(item.end);
  const likely = day(item.forecast.likely);
  if (start !== null && end !== null) return { start, end, openStart: false, ghost: false };
  if (end !== null) return { start: Math.min(end - 13, today), end, openStart: true, ghost: false };
  const from = start ?? today;
  if (likely !== null)
    return { start: from, end: Math.max(likely, from), openStart: start === null, ghost: true };
  if (start !== null) return { start, end: start + 27, openStart: false, ghost: true };
  return null;
}

export function placeBar(
  item: RoadmapItem,
  scale: TimelineScale,
  today: number,
  moved?: Dates | null,
): BarPlace | null {
  const shape = barDates(item, today);
  if (!shape) return null;
  const dates = moved ?? { start: shape.start, end: shape.end };
  const left = scale.x(dates.start);
  const width = scale.x(dates.end) + scale.dayWidth - left;
  const { forecast } = item;
  const likely = day(forecast.likely);
  const earliest = day(forecast.earliest);
  const latest = day(forecast.latest);
  const late =
    forecast.state === 'late' && likely !== null && likely > dates.end && !shape.ghost
      ? {
          width: (likely - dates.end) * scale.dayWidth,
          label: `Forecast ${shortDate(likely, yearOfDay(today))}`,
        }
      : null;
  const centre = (value: number) => scale.x(value) + scale.dayWidth / 2;
  const range =
    likely !== null && earliest !== null && latest !== null && forecast.state !== 'done'
      ? {
          from: centre(earliest),
          likely: centre(likely),
          to: centre(latest),
          warn: forecast.state === 'late' || forecast.state === 'at_risk',
        }
      : null;
  return {
    dates,
    left,
    width,
    openStart: shape.openStart && !moved,
    ghost: shape.ghost,
    late,
    range,
  };
}

/** An issue under an epic: a thin bar when it has both dates, or a day's tick at its due date. */
export function childBar(child: RoadmapChild, scale: TimelineScale) {
  const due = day(child.dueAt);
  if (due === null) return null;
  const start = day(child.startAt) ?? due;
  const left = scale.x(Math.min(start, due));
  return { left, width: scale.x(due) + scale.dayWidth - left };
}

/** Dependency lines between the bars on screen; amber where the waiting one starts first. */
export function dependencyLines(
  dependencies: readonly { id: string; fromId: string; toId: string }[],
  rows: readonly RoadmapRow[],
  tops: readonly number[],
  bars: ReadonlyMap<string, BarPlace>,
): DependencyLine[] {
  const rowOf = new Map(rows.map((row, index) => [row.id, index]));
  return dependencies.flatMap((dependency) => {
    const from = bars.get(dependency.fromId);
    const to = bars.get(dependency.toId);
    const a = rowOf.get(dependency.fromId);
    const b = rowOf.get(dependency.toId);
    if (!from || !to || a === undefined || b === undefined) return [];
    const middle = (index: number) => (tops[index] ?? 0) + ROW_HEIGHT.item / 2;
    return [
      {
        id: dependency.id,
        from: { x: from.left + from.width, y: middle(a) },
        to: { x: to.left, y: middle(b) },
        conflict: to.dates.start < from.dates.end,
      },
    ];
  });
}

/** Scrolls so today sits a little in from the left edge of the lanes. */
export function scrollToToday(
  scroller: HTMLElement | null,
  scale: TimelineScale,
  today: number,
  smooth = false,
) {
  if (!scroller) return;
  const left = Math.max(0, scale.x(today) - 96);
  if (typeof scroller.scrollTo === 'function')
    scroller.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
  else scroller.scrollLeft = left;
}

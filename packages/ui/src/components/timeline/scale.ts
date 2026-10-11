/*
 * The roadmap's time axis. Days are whole numbers since 1970-01-01 in UTC, so a bar never
 * moves a day with the viewer's time zone. A zoom sets how wide a day is; the scale turns days
 * into pixels and back, and names the two tiers of the header: months over weeks when zoomed
 * to weeks or months, quarters over months when zoomed out to quarters.
 */

export type TimelineZoom = 'weeks' | 'months' | 'quarters';

/** Pixels per day: a week is 168px wide, a month about 180px, a quarter about 180px. */
export const DAY_WIDTH: Readonly<Record<TimelineZoom, number>> = {
  weeks: 24,
  months: 6,
  quarters: 2,
};

const DAY_MS = 86_400_000;

export const dayOfIso = (iso: string): number =>
  Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

export const isoOfDay = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const utc = (day: number) => new Date(day * DAY_MS);

/** "Oct 21", or "Oct 21, 2027" when the year is not `thisYear`. */
export function shortDate(day: number, thisYear?: number): string {
  const date = utc(day);
  const words = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
  return thisYear === undefined || date.getUTCFullYear() === thisYear
    ? words
    : `${words}, ${date.getUTCFullYear()}`;
}

export const yearOfDay = (day: number): number => utc(day).getUTCFullYear();

export interface TimelineScale {
  zoom: TimelineZoom;
  /** The first and last day drawn. */
  from: number;
  to: number;
  dayWidth: number;
  width: number;
  /** The left edge of a day, in pixels from the start of the axis. */
  x(day: number): number;
  /** The day under a pixel offset, rounded to the nearest day boundary. */
  dayAt(x: number): number;
}

/** Monday of the week the day falls in (1970-01-01 was a Thursday). */
export const weekStart = (day: number): number => day - ((day + 3) % 7);

const monthStart = (day: number) => {
  const date = utc(day);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / DAY_MS;
};

const addMonths = (day: number, months: number) => {
  const date = utc(day);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1) / DAY_MS;
};

const quarterStart = (day: number) => {
  const date = utc(day);
  return Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3, 1) / DAY_MS;
};

/**
 * A scale covering `from` to `to`, widened to whole tiers (months, or quarters when zoomed
 * out) so the header starts and ends on a boundary.
 */
export function timelineScale(zoom: TimelineZoom, from: number, to: number): TimelineScale {
  const start = zoom === 'quarters' ? quarterStart(from) : monthStart(from);
  const last = zoom === 'quarters' ? addMonths(quarterStart(to), 3) : addMonths(to, 1);
  const end = Math.max(last - 1, start);
  const dayWidth = DAY_WIDTH[zoom];
  return {
    zoom,
    from: start,
    to: end,
    dayWidth,
    width: (end - start + 1) * dayWidth,
    x: (day) => (day - start) * dayWidth,
    dayAt: (x) => start + Math.round(x / dayWidth),
  };
}

export interface TimelineTick {
  /** Stable key and first day of the span. */
  day: number;
  x: number;
  width: number;
  label: string;
  /** The full name, for assistive tech and tooltips: "October 2026", "Week of Oct 5". */
  title: string;
}

const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function spans(
  scale: TimelineScale,
  first: number,
  next: (day: number) => number,
  name: (day: number) => { label: string; title: string },
): TimelineTick[] {
  const ticks: TimelineTick[] = [];
  for (let day = first; day <= scale.to; day = next(day)) {
    const left = Math.max(day, scale.from);
    const right = Math.min(next(day) - 1, scale.to);
    ticks.push({
      day: left,
      x: scale.x(left),
      width: (right - left + 1) * scale.dayWidth,
      ...name(day),
    });
  }
  return ticks;
}

const monthName = (day: number) => {
  const date = utc(day);
  const month = date.getUTCMonth();
  return {
    label: `${MONTHS[month]} ${date.getUTCFullYear()}`,
    title: `${LONG_MONTHS[month]} ${date.getUTCFullYear()}`,
  };
};

/** The header's two tiers for the scale's zoom. */
export function timelineTicks(scale: TimelineScale): {
  major: TimelineTick[];
  minor: TimelineTick[];
} {
  if (scale.zoom === 'quarters') {
    return {
      major: spans(
        scale,
        scale.from,
        (day) => addMonths(day, 3),
        (day) => {
          const date = utc(day);
          const label = `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
          return { label, title: label };
        },
      ),
      minor: spans(
        scale,
        scale.from,
        (day) => addMonths(day, 1),
        (day) => ({ label: MONTHS[utc(day).getUTCMonth()] ?? '', title: monthName(day).title }),
      ),
    };
  }
  return {
    major: spans(scale, scale.from, (day) => addMonths(day, 1), monthName),
    minor: spans(
      scale,
      weekStart(scale.from),
      (day) => day + 7,
      (day) => ({
        label: String(utc(day).getUTCDate()),
        title: `Week of ${shortDate(day, yearOfDay(day))}`,
      }),
    ),
  };
}

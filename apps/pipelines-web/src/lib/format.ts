import { getLocale } from '@bemmoly/core-web';

/*
 * Durations and shares in the person's language. Intl.DurationFormat gives "3h 10m" as each
 * language writes it; where a browser lacks it, the hours and minutes are formatted as units.
 */

interface DurationFormatter {
  format(duration: { hours?: number; minutes?: number; seconds?: number }): string;
}

type DurationFormatConstructor = new (
  locale: string,
  options: { style: 'narrow' },
) => DurationFormatter;

export function formatDuration(totalSeconds: number, locale = getLocale()): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = hours === 0 && minutes === 0 ? Math.round(totalSeconds) : 0;
  const parts = {
    ...(hours ? { hours } : {}),
    ...(minutes ? { minutes } : {}),
    ...(seconds || (!hours && !minutes) ? { seconds } : {}),
  };
  const Duration = (Intl as unknown as { DurationFormat?: DurationFormatConstructor })
    .DurationFormat;
  if (Duration) return new Duration(locale, { style: 'narrow' }).format(parts);
  const unit = (value: number, name: 'hour' | 'minute' | 'second') =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'narrow' }).format(
      value,
    );
  return [
    hours ? unit(hours, 'hour') : '',
    minutes ? unit(minutes, 'minute') : '',
    'seconds' in parts ? unit(seconds, 'second') : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** 0.021 as "2.1%". */
export function formatShare(value: number, locale = getLocale()): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(
    value,
  );
}

/** How long ago, in one narrow unit: "12m", "4h", "3d", "9w". For tight cells beside a value. */
export function formatAge(iso: string, now = Date.now(), locale = getLocale()): string {
  const seconds = Math.max(0, (now - Date.parse(iso)) / 1000);
  const [value, unit] =
    seconds < 3600
      ? [Math.max(1, Math.round(seconds / 60)), 'minute' as const]
      : seconds < 86_400
        ? [Math.round(seconds / 3600), 'hour' as const]
        : seconds < 86_400 * 60
          ? [Math.round(seconds / 86_400), 'day' as const]
          : [Math.round(seconds / (86_400 * 7)), 'week' as const];
  return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'narrow' }).format(
    value,
  );
}

/** "2h 40m" without seconds once past a minute: lead times and run durations in a row. */
export function formatSpan(totalSeconds: number, locale = getLocale()): string {
  if (totalSeconds >= 86_400) {
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.round((totalSeconds % 86_400) / 3600);
    const unit = (value: number, name: 'day' | 'hour') =>
      new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'narrow' }).format(
        value,
      );
    return hours ? `${unit(days, 'day')} ${unit(hours, 'hour')}` : unit(days, 'day');
  }
  return formatDuration(
    totalSeconds >= 60 ? totalSeconds - (totalSeconds % 60) : totalSeconds,
    locale,
  );
}

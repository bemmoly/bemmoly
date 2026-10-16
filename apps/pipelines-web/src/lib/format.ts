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

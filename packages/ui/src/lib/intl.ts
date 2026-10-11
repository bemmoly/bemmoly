import { useSyncExternalStore } from 'react';

/*
 * The locale every date, number and relative time is formatted in. The kit draws them
 * (RelativeTime), so it holds the locale; the shell's i18n runtime in @bemmoly/core-web sets it
 * whenever the person's language changes (ADR 0024). Formatters are built once per locale and
 * options, because Intl constructors are slow and lists render hundreds of times.
 */

let active = 'en';
const listeners = new Set<() => void>();
const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat>();

export function getFormatLocale(): string {
  return active;
}

export function setFormatLocale(locale: string): void {
  if (locale === active) return;
  active = locale;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The formatting locale, re-rendering when it changes. */
export function useFormatLocale(): string {
  return useSyncExternalStore(subscribe, getFormatLocale, getFormatLocale);
}

function memo<T extends Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat>(
  kind: string,
  locale: string,
  options: object,
  make: () => T,
): T {
  const key = `${kind}|${locale}|${JSON.stringify(options)}`;
  let formatter = cache.get(key) as T | undefined;
  if (!formatter) {
    formatter = make();
    cache.set(key, formatter);
  }
  return formatter;
}

export function dateFormat(options: Intl.DateTimeFormatOptions, locale = active) {
  return memo('date', locale, options, () => new Intl.DateTimeFormat(locale, options));
}

export function numberFormat(options: Intl.NumberFormatOptions = {}, locale = active) {
  return memo('number', locale, options, () => new Intl.NumberFormat(locale, options));
}

export function relativeFormat(options: Intl.RelativeTimeFormatOptions, locale = active) {
  return memo('relative', locale, options, () => new Intl.RelativeTimeFormat(locale, options));
}

/** "1,234.5" in English, "1 234,5" in French. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return numberFormat(options).format(value);
}

/** A date (or ISO string) in the active locale, with the given fields. */
export function formatDate(value: Date | string, options: Intl.DateTimeFormatOptions): string {
  return dateFormat(options).format(typeof value === 'string' ? new Date(value) : value);
}

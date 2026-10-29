import { useLocale } from '@bemmoly/core-web';
import { useCallback } from 'react';

/** "2 Nov" for a calendar date in the reader's language; the year only when it differs. */
export function useDateText() {
  const locale = useLocale();
  return useCallback(
    (date: string | null | undefined) => {
      if (!date) return '';
      const at = new Date(`${date}T00:00:00Z`);
      const sameYear = at.getUTCFullYear() === new Date().getUTCFullYear();
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        ...(sameYear ? {} : { year: 'numeric' }),
        timeZone: 'UTC',
      }).format(at);
    },
    [locale],
  );
}

/** The time now in a location's zone, "12:42", for the directory's local time. */
export function localTime(locale: string, timezone: string | null | undefined): string | null {
  if (!timezone) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    }).format(new Date());
  } catch {
    return null;
  }
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

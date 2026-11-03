/** Morning before noon, afternoon before six, evening after. */
export function greetingId(hour: number) {
  if (hour < 12) return 'pipelinesForYou.greeting.morning' as const;
  if (hour < 18) return 'pipelinesForYou.greeting.afternoon' as const;
  return 'pipelinesForYou.greeting.evening' as const;
}

/** "Tuesday, 3 November" in the reader's language. */
export function todayLine(now: Date, locale?: string) {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(
    now,
  );
}

/** Deploys this week against last, as a signed whole percent; null without a last week. */
export function weekChange(thisWeek: number, lastWeek: number): number | null {
  if (lastWeek === 0) return null;
  return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
}

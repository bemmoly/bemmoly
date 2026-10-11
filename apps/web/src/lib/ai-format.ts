/** Numbers in Settings › AI, in the words and units admins compare models by. */

/** "200K context", "1M context"; null when the catalog does not say. */
export function contextLine(tokens: number | null | undefined): string | null {
  if (!tokens) return null;
  if (tokens >= 1_000_000) {
    const millions = tokens / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M context`;
  }
  return `${Math.round(tokens / 1000)}K context`;
}

const usd = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const perMillion = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

/** "$12.40". */
export function formatUsd(amount: number): string {
  return usd.format(amount);
}

/** "$3 in · $15 out per M tokens", "Free" for a local model, null when unknown. */
export function priceLine(input: number | null | undefined, output: number | null | undefined) {
  if (input == null && output == null) return null;
  if (!input && !output) return 'Free';
  return `${perMillion.format(input ?? 0)} in · ${perMillion.format(output ?? 0)} out per M tokens`;
}

/** "Released Feb 2026"; null when the catalog has no date. */
export function releaseLine(date: string | null | undefined): string | null {
  if (!date) return null;
  const parsed = new Date(date.length === 7 ? `${date}-01` : date);
  if (Number.isNaN(parsed.getTime())) return null;
  const month = parsed.toLocaleString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `Released ${month}`;
}

/** "1,840", "27K", "1.5M": runs and tokens, tabular in tables. */
export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  return value.toLocaleString('en');
}

/** "October 2026" for a "2026-10" month key. */
export function monthName(month: string): string {
  const parsed = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return month;
  return parsed.toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** "1 November": when a monthly budget starts over (UTC calendar month). */
export function nextMonthStart(month: string): string {
  const [year = 0, index = 1] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, index, 1));
  return next.toLocaleString('en', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

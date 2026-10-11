const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "now", "5m ago", "3h ago", "yesterday", "Friday", "12 days ago", "Oct 2", as in the mocks. */
export function formatRelative(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'Never';
  const then = new Date(iso);
  const diff = now.getTime() - then.getTime();
  if (diff < MINUTE) return 'now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  const days = Math.round((startOfDay(now) - startOfDay(then)) / DAY);
  if (days === 0) return `${Math.floor(diff / HOUR)}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return then.toLocaleDateString('en', { weekday: 'long' });
  if (days < 60) return `${days} days ago`;
  return then.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

/** "Oct 7, 2026, 14:32": the absolute date and time a relative time stands for. */
export function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

/** "Rohan S." → "RS"; "priya@acme.dev" → "P". */
export function initials(name: string): string {
  // indexOf, not /@.*$/: that retries from every @ and is quadratic on a run of them.
  const at = name.indexOf('@');
  const words = (at === -1 ? name : name.slice(0, at)).split(/[\s._-]+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0]];
  return letters
    .map((word) => word?.charAt(0) ?? '')
    .join('')
    .toUpperCase();
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Decimal units, one decimal under ten: "512 MB", "1.4 GB". */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const rounded = value < 10 && unit > 0 ? value.toFixed(1) : String(Math.round(value));
  return `${rounded} ${UNITS[unit]}`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Relative times live with RelativeTime in the UI kit, so a hover can show the date. */
export { formatAbsolute, formatRelative } from '@bemmoly/ui/time';

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

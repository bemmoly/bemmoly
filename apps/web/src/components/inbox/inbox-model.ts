import type { Notification } from '@bemmoly/shared';

/** The inbox's segments: everything, or one kind of ask. */
export type InboxFilter = 'all' | 'mentions' | 'reviews' | 'assigned';

export const INBOX_FILTERS: readonly {
  value: InboxFilter;
  label: string;
  kinds?: readonly string[];
}[] = [
  { value: 'all', label: 'All' },
  { value: 'mentions', label: 'Mentions', kinds: ['mention'] },
  { value: 'reviews', label: 'Reviews', kinds: ['review_request'] },
  { value: 'assigned', label: 'Assigned', kinds: ['assignment'] },
];

export function applyFilter(items: readonly Notification[], filter: InboxFilter): Notification[] {
  const kinds = INBOX_FILTERS.find((entry) => entry.value === filter)?.kinds;
  return kinds ? items.filter((item) => kinds.includes(item.kind)) : [...items];
}

export interface DayGroup {
  label: string;
  items: Notification[];
}

const dayStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Today, Yesterday and Earlier, newest first within each, as the list is sorted. */
export function groupByDay(items: readonly Notification[], now = new Date()): DayGroup[] {
  const today = dayStart(now);
  const yesterday = today - 86_400_000;
  const groups: DayGroup[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Earlier', items: [] },
  ];
  for (const item of items) {
    const at = dayStart(new Date(item.createdAt));
    const group = at >= today ? groups[0] : at >= yesterday ? groups[1] : groups[2];
    group?.items.push(item);
  }
  return groups.filter((group) => group.items.length > 0);
}

/** What a notification is, in the chip beside its key. */
export function kindLabel(kind: string): string {
  const labels: Record<string, string> = {
    mention: 'Mentioned you',
    review_request: 'Review requested',
    assignment: 'Assigned to you',
    comment: 'New comment',
    status_change: 'Status changed',
    watch_update: 'Watching',
  };
  return labels[kind] ?? 'Update';
}

/** True for a link inside the app, which opens in place rather than in a new tab. */
export const inApp = (url: string | null | undefined): url is string =>
  Boolean(url?.startsWith('/') && !url.startsWith('//'));

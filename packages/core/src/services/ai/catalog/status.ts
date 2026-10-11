import type { AiCatalogSource, AiCatalogStatus, CatalogData } from '@bemmoly/shared';
import { countModels } from './trim.ts';

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "just now", "4 minutes ago", "3 hours ago", "2 days ago". */
export function relativeTime(at: Date, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const units: [number, string][] = [
    [86_400, 'day'],
    [3_600, 'hour'],
    [60, 'minute'],
  ];
  for (const [size, unit] of units) {
    if (seconds >= size) {
      const count = Math.floor(seconds / size);
      return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}

/** The status line on the picker and Settings › AI, in the tech design's words. */
export function statusLine(input: {
  source: AiCatalogSource;
  offline: boolean;
  fetchedAt: Date | null;
  bundledWith: string;
  now: Date;
}): string {
  if (input.source === 'bundled' || !input.fetchedAt) {
    return `Offline · bundled with ${input.bundledWith}`;
  }
  if (!input.offline)
    return `Live · models.dev · updated ${relativeTime(input.fetchedAt, input.now)}`;
  const date = DATE.format(input.fetchedAt);
  return input.source === 'uploaded'
    ? `Offline · uploaded ${date}`
    : `Offline · last fetched ${date}`;
}

export function catalogStatus(input: {
  data: CatalogData;
  source: AiCatalogSource;
  offline: boolean;
  fetchedAt: Date | null;
  bundledWith: string;
  liveFetch: boolean;
  now: Date;
}): AiCatalogStatus {
  return {
    source: input.source,
    offline: input.offline,
    fetchedAt: input.fetchedAt?.toISOString() ?? null,
    bundledWith: input.source === 'bundled' ? input.bundledWith : null,
    line: statusLine(input),
    liveFetch: input.liveFetch,
    providerCount: Object.keys(input.data).length,
    modelCount: countModels(input.data),
  };
}

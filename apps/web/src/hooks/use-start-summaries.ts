import { queryKeys } from '@bemmoly/api-client';
import type { StartEntry, StartSummary } from '@bemmoly/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../lib/api.ts';

/** A row on the start page, with the product it opens into. */
export type StartRow = StartEntry & { moduleId: string };

const NEEDS_SHOWN = 8;
const RECENT_SHOWN = 6;

/** Soonest due first; undated needs after the dated ones. */
const byDue = (a: StartRow, b: StartRow) =>
  (a.at ?? '9999').localeCompare(b.at ?? '9999') || a.title.localeCompare(b.title);
const byNewest = (a: StartRow, b: StartRow) => (b.at ?? '').localeCompare(a.at ?? '');

const rows = (items: readonly StartSummary[], pick: (item: StartSummary) => StartEntry[]) =>
  items.flatMap((item) => pick(item).map((entry) => ({ ...entry, moduleId: item.moduleId })));

/**
 * What each product holds for the person, merged for the start page: the waiting count per
 * product, every product's "needs you" soonest first, and their recents newest first.
 */
export function useStartSummaries() {
  const query = useQuery({
    queryKey: queryKeys.startSummaries(),
    queryFn: () => api.startSummaries(),
    select: (response) => response.items,
  });
  const items = query.data;
  return useMemo(() => {
    const all = items ?? [];
    const needs = rows(all, (item) => item.needsYou).sort(byDue);
    return {
      ...query,
      waiting: new Map(all.map((item) => [item.moduleId, item.waiting])),
      needs: needs.slice(0, NEEDS_SHOWN),
      needsTotal: needs.length,
      recent: rows(all, (item) => item.recent)
        .sort(byNewest)
        .slice(0, RECENT_SHOWN),
    };
  }, [items, query]);
}

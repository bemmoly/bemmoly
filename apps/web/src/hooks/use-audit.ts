import { queryKeys, type AuditFilter } from '@bemmoly/api-client';
import type { AuditEntry, User } from '@bemmoly/shared';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.ts';
import { useDirectory } from './use-directory.ts';

const PAGE = 50;
/** Typing an action prefix waits this long before asking the server. */
const TYPING_MS = 300;

/** The filter bar as typed: dates are the date inputs' YYYY-MM-DD in local time. */
export interface AuditFilters {
  action: string;
  actorId: string;
  targetKind: string;
  since: string;
  until: string;
}

export const NO_FILTERS: AuditFilters = {
  action: '',
  actorId: '',
  targetKind: '',
  since: '',
  until: '',
};

/** The query the server takes: empty filters are left out; dates cover whole local days. */
export function toAuditQuery(filters: AuditFilters): AuditFilter {
  const query: AuditFilter = {};
  const action = filters.action.trim();
  if (action) query.action = action;
  if (filters.actorId) query.actorId = filters.actorId;
  if (filters.targetKind) query.targetKind = filters.targetKind;
  if (filters.since) query.since = new Date(`${filters.since}T00:00:00`).toISOString();
  if (filters.until) query.until = new Date(`${filters.until}T23:59:59.999`).toISOString();
  return query;
}

/** Who did it, in words: a person from the directory, or what acted for them. */
export function actorName(entry: AuditEntry, byId: ReadonlyMap<string, User>): string {
  if (entry.actorKind === 'system') return 'System';
  const person = byId.get(entry.actorUserId ?? entry.actorId ?? '')?.name;
  if (entry.actorKind === 'api_token') return person ? `API token · ${person}` : 'API token';
  if (entry.actorKind === 'ai_plan') return person ? `AI plan · ${person}` : 'AI plan';
  return person ?? 'Unknown person';
}

/** Settings › Audit log: filtered, keyset-paged, and exportable as CSV with the same filters. */
export function useAuditLog() {
  const [filters, setFilters] = useState<AuditFilters>(NO_FILTERS);
  const [action, setAction] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setAction(filters.action), TYPING_MS);
    return () => clearTimeout(timer);
  }, [filters.action]);

  const query = useMemo(() => toAuditQuery({ ...filters, action }), [filters, action]);
  const list = useInfiniteQuery({
    queryKey: queryKeys.audit.list(query),
    queryFn: ({ pageParam }) =>
      api.audit.list({ ...query, limit: PAGE, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
  const { directory } = useDirectory();

  const entries = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const targetKinds = useMemo(() => {
    const kinds = new Set(entries.map((entry) => entry.targetKind));
    if (filters.targetKind) kinds.add(filters.targetKind);
    return [...kinds].sort();
  }, [entries, filters.targetKind]);

  return {
    ...list,
    entries,
    filters,
    setFilter: (patch: Partial<AuditFilters>) => setFilters({ ...filters, ...patch }),
    clear: () => {
      setFilters(NO_FILTERS);
      setAction('');
    },
    filtered: JSON.stringify(filters) !== JSON.stringify(NO_FILTERS),
    people: directory.users,
    targetKinds,
    actorOf: (entry: AuditEntry) => actorName(entry, directory.byId),
    exportUrl: api.audit.exportUrl(query),
  };
}

import { queryKeys } from '@bemmoly/api-client';
import {
  IMPORT_TARGET_KEY_PATTERN,
  type ImportContainerFilter,
  type ImportContainerRow,
  type ImportJob,
} from '@bemmoly/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { importsApi } from '../lib/imports-api.ts';
import type { ImportPlanUpdate } from './use-import-plan-update.ts';

/** A key is sent this long after the last keystroke, so typing asks once. */
export const KEY_DEBOUNCE_MS = 300;
const PAGE = 100;
/** The key rule's words, as the contract's schema states them. */
export const KEY_RULE = 'Use 2 to 10 capitals or digits';

export type TargetMode = 'create' | 'existing' | 'update';

/** "sup-2" → "SUP2": what a key field accepts as it is typed. */
export const keyInput = (raw: string) =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);

const rowsOf = (jobId: string, filter: ImportContainerFilter, cursor?: string) =>
  importsApi.containers(jobId, { filter, limit: PAGE, ...(cursor ? { cursor } : {}) });

/**
 * Where each chosen project or space goes. The rows that want a look (an error, an existing
 * target, an update, a new key) come first and stay first while they are edited; the rest
 * wait behind "Show N more". A key is checked against the rule as it is typed and sent a
 * beat later; the server's answer (taken, renamed) comes back on the row.
 */
export function useImportTargets(job: ImportJob, update: ImportPlanUpdate) {
  const [expanded, setExpanded] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [modes, setModes] = useState<Record<string, TargetMode>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const attention = useQuery({
    queryKey: queryKeys.imports.containers(job.id, '', 'attention'),
    queryFn: () => rowsOf(job.id, 'attention'),
  });
  const selected = useInfiniteQuery({
    queryKey: queryKeys.imports.containers(job.id, '', 'selected'),
    queryFn: ({ pageParam }) => rowsOf(job.id, 'selected', pageParam || undefined),
    initialPageParam: '',
    getNextPageParam: (last) => last.next ?? undefined,
  });

  // A row that wanted a look keeps its place at the top while it is fixed.
  const pinned = useRef<string[]>([]);
  for (const row of attention.data?.items ?? []) {
    if (!pinned.current.includes(row.id)) pinned.current.push(row.id);
  }
  const known = useMemo(() => {
    const map = new Map<string, ImportContainerRow>();
    for (const row of attention.data?.items ?? []) map.set(row.id, row);
    for (const page of selected.data?.pages ?? [])
      for (const row of page.items) map.set(row.id, row);
    return map;
  }, [attention.data, selected.data]);
  const top = pinned.current.flatMap((id) => known.get(id) ?? []);
  const rest = (selected.data?.pages ?? [])
    .flatMap((page) => page.items)
    .filter((row) => !pinned.current.includes(row.id));
  const total = selected.data?.pages[0]?.view.total ?? job.plan?.containers.length ?? 0;

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, []);

  const send = (id: string, key: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        update.mutate(
          { targets: { [id]: { mode: 'create', key } } },
          {
            onSuccess: () =>
              setDrafts(({ [id]: typed, ...others }) =>
                typed === undefined || typed === key ? others : { ...others, [id]: typed },
              ),
          },
        );
      }, KEY_DEBOUNCE_MS),
    );
  };

  const modeOf = (row: ImportContainerRow): TargetMode =>
    modes[row.id] ?? row.target?.mode ?? 'create';
  const keyOf = (row: ImportContainerRow) => drafts[row.id] ?? row.target?.key ?? row.key ?? '';
  /** The rule's words while the typed key breaks it, else the server's reason, if any. */
  const errorOf = (row: ImportContainerRow): string | null => {
    const mode = modeOf(row);
    if (mode === 'create' && row.id in drafts) {
      return IMPORT_TARGET_KEY_PATTERN.test(keyOf(row)) ? null : KEY_RULE;
    }
    if (mode !== (row.target?.mode ?? 'create')) return null;
    return row.target?.error ?? null;
  };
  const unpicked = [...top, ...rest].find(
    (row) => modes[row.id] === 'existing' && row.target?.mode !== 'existing',
  );
  const firstError = top.find((row) => errorOf(row)) ?? rest.find((row) => errorOf(row));

  return {
    loading: attention.isPending || selected.isPending,
    error: attention.error ?? selected.error,
    top,
    rest,
    total,
    expanded,
    toggle: () => setExpanded((open) => !open),
    hasMore: Boolean(selected.hasNextPage),
    loadMore: () => void selected.fetchNextPage(),
    modeOf,
    keyOf,
    errorOf,
    /** Something still to fix or still being sent; Review waits. */
    blocked:
      (job.plan?.targets?.errors ?? 0) > 0 || Object.keys(drafts).length > 0 || Boolean(unpicked),
    firstError: firstError ?? null,
    /** A row switched to Existing with nothing picked yet. */
    unpicked: unpicked ?? null,
    setKey: (row: ImportContainerRow, raw: string) => {
      const key = keyInput(raw);
      setDrafts((current) => ({ ...current, [row.id]: key }));
      if (IMPORT_TARGET_KEY_PATTERN.test(key)) send(row.id, key);
      else clearTimeout(timers.current.get(row.id));
    },
    setMode: (row: ImportContainerRow, mode: 'create' | 'existing') => {
      setModes((current) => ({ ...current, [row.id]: mode }));
      if (mode === 'create' && row.target?.mode === 'existing') {
        const key = keyInput(row.key ?? row.name);
        if (IMPORT_TARGET_KEY_PATTERN.test(key)) {
          update.mutate({ targets: { [row.id]: { mode: 'create', key } } });
        } else setDrafts((current) => ({ ...current, [row.id]: key }));
      }
    },
    pick: (row: ImportContainerRow, id: string) =>
      update.mutate({ targets: { [row.id]: { mode: 'existing', id } } }),
  };
}

export type ImportTargets = ReturnType<typeof useImportTargets>;

import { queryKeys } from '@bemmoly/api-client';
import type { ImportSelectionOp } from '@bemmoly/shared';
import { useOptionalToast } from '@bemmoly/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { importsApi } from '../lib/imports-api.ts';
import type { SeqOp } from './import-overlay.ts';

/** Ticks wait this long for the next one, so a run of clicks goes in one request. */
export const SELECTION_DEBOUNCE_MS = 150;
const BATCH = 200;

/** Operations that touch rows beyond the ones loaded; the list is read again after them. */
const isWide = (op: ImportSelectionOp) => !('ids' in op);

/**
 * The selection the server keeps for one import. Ticks are operations: kept in order, shown at
 * once (the chooser replays them on its rows), sent a moment later one request at a time, so
 * the server applies them in the order they were made. A refused request takes its ticks back.
 */
export function useImportSelection(jobId: string) {
  const client = useQueryClient();
  const toast = useOptionalToast();
  const summary = useQuery({
    queryKey: queryKeys.imports.selection(jobId),
    queryFn: () => importsApi.selection(jobId),
  });
  const [ops, setOps] = useState<SeqOp[]>([]);
  const [summarySeq, setSummarySeq] = useState(0);
  const seq = useRef(0);
  const acked = useRef(0);
  const queue = useRef<SeqOp[]>([]);
  const running = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const send = useCallback(async () => {
    while (queue.current.length > 0) {
      const batch = queue.current.splice(0, BATCH);
      const last = batch.at(-1)?.seq ?? acked.current;
      try {
        const result = await importsApi.select(jobId, { ops: batch.map((entry) => entry.op) });
        acked.current = last;
        client.setQueryData(queryKeys.imports.selection(jobId), result);
        setSummarySeq(last);
        if (batch.some((entry) => isWide(entry.op))) {
          void client.invalidateQueries({
            queryKey: [...queryKeys.imports.detail(jobId), 'containers'],
          });
        }
      } catch {
        const failed = new Set(batch.map((entry) => entry.seq));
        acked.current = last;
        setOps((current) => current.filter((entry) => !failed.has(entry.seq)));
        toast?.show({
          tone: 'danger',
          title: "Couldn't save the selection",
          body: 'Your last ticks were put back. Check your connection and try again.',
        });
      }
    }
  }, [client, jobId, toast]);

  /** Sends whatever is waiting and resolves once the server has every operation. */
  const flush = useCallback((): Promise<void> => {
    clearTimeout(timer.current);
    running.current ??= send().finally(() => {
      running.current = null;
    });
    return running.current;
  }, [send]);

  const push = useCallback(
    (...next: ImportSelectionOp[]) => {
      const entries = next.map((op) => {
        seq.current += 1;
        return { seq: seq.current, op };
      });
      queue.current.push(...entries);
      setOps((current) => [...current, ...entries]);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SELECTION_DEBOUNCE_MS);
    },
    [flush],
  );

  // Leaving the chooser sends what is waiting rather than dropping it.
  useEffect(
    () => () => {
      if (queue.current.length > 0) void flush();
    },
    [flush],
  );

  return {
    summary: summary.data,
    summaryLoading: summary.isPending,
    summarySeq,
    ops,
    push,
    flush,
    /** The last operation the server has applied. */
    acked: () => acked.current,
  };
}

export type ImportSelection = ReturnType<typeof useImportSelection>;

import { topicOf, type LogLine } from '@bemmoly/module-pipelines/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStream } from '../../hooks/use-stream.ts';
import { api } from '../../lib/api.ts';

/** Lines are read in blocks, so scrolling fast through a long log asks once per block. */
const BLOCK = 500;
const blockOf = (line: number) => Math.floor((line - 1) / BLOCK);

export interface JobLog {
  status: 'loading' | 'ready' | 'error';
  totalLines: number;
  complete: boolean;
  firstErrorLine: number | null;
  getLine: (number: number) => LogLine | undefined;
  ensure: (from: number, to: number) => void;
  retry: () => void;
}

/**
 * One job's log: the end first (where a running job writes and a failed one usually broke),
 * then any block the view scrolls to. While the job writes, the stream appends lines; a gap
 * the stream skipped is read back by range, as the contract says.
 */
export function useJobLog(jobId: string | null, live: boolean): JobLog {
  const lines = useRef(new Map<number, LogLine>());
  const asked = useRef(new Set<number>());
  const [, setVersion] = useState(0);
  const [state, setState] = useState({
    status: 'loading' as JobLog['status'],
    totalLines: 0,
    complete: false,
    firstErrorLine: null as number | null,
    attempt: 0,
  });
  const bump = () => setVersion((value) => value + 1);

  const store = useCallback((incoming: readonly LogLine[]) => {
    for (const line of incoming) lines.current.set(line.number, line);
    bump();
  }, []);

  const readBlock = useCallback(
    (block: number) => {
      if (!jobId || asked.current.has(block)) return;
      asked.current.add(block);
      const from = block * BLOCK + 1;
      api.delivery
        .log(jobId, { from, to: from + BLOCK - 1 })
        .then((range) => {
          store(range.lines);
          setState((current) => ({
            ...current,
            totalLines: Math.max(current.totalLines, range.totalLines),
            complete: range.complete,
          }));
        })
        .catch(() => asked.current.delete(block));
    },
    [jobId, store],
  );

  useEffect(() => {
    // The panel is keyed by job, so a new job starts with fresh state; this runs per attempt.
    if (!jobId) return undefined;
    let cancelled = false;
    api.delivery
      .log(jobId, { tail: BLOCK })
      .then((range) => {
        if (cancelled) return;
        store(range.lines);
        const firstTail = range.lines[0]?.number;
        if (firstTail) asked.current.add(blockOf(range.totalLines));
        setState((current) => ({
          ...current,
          status: 'ready',
          totalLines: range.totalLines,
          complete: range.complete,
          firstErrorLine: range.firstErrorLine,
        }));
        if (range.firstErrorLine && !lines.current.has(range.firstErrorLine))
          readBlock(blockOf(range.firstErrorLine));
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({ ...current, status: 'error' }));
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, readBlock, store, state.attempt]);

  useStream(jobId && live ? [topicOf.jobLog(jobId)] : [], (event) => {
    if (event.kind !== 'log.appended') return;
    const { lines: appended, fromLine, toLine } = event.data;
    store(appended);
    const last = Math.max(toLine ?? 0, appended.at(-1)?.number ?? 0);
    setState((current) => ({ ...current, totalLines: Math.max(current.totalLines, last) }));
    // Whatever the event did not carry is read back by block.
    const missingFrom = appended.length ? (appended.at(-1)?.number ?? fromLine) + 1 : fromLine;
    for (
      let block = blockOf(Math.max(1, missingFrom));
      missingFrom <= last && block <= blockOf(last);
      block += 1
    ) {
      asked.current.delete(block);
      readBlock(block);
    }
  });

  return {
    ...state,
    getLine: (number) => lines.current.get(number),
    ensure: (from, to) => {
      for (
        let block = blockOf(Math.max(1, from));
        block <= blockOf(Math.max(from, to));
        block += 1
      ) {
        const start = block * BLOCK + 1;
        if (!lines.current.has(start) || !lines.current.has(Math.min(to, start + BLOCK - 1)))
          readBlock(block);
      }
    },
    retry: () => setState((current) => ({ ...current, attempt: current.attempt + 1 })),
  };
}

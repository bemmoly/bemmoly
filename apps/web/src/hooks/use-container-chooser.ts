import type {
  ImportContainerFilter,
  ImportJob,
  ImportSelectionOp,
  ImportSource,
} from '@bemmoly/shared';
import { useOptionalToast } from '@bemmoly/ui';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { nounsOf, plural } from '../components/import/import-words.ts';
import { overlayRows, summaryNow, viewSelected, type BeforeClear } from './import-overlay.ts';
import { useImportContainers } from './use-import-containers.ts';
import { useImportSelection } from './use-import-selection.ts';
import { useNarrow } from './use-narrow.ts';

export const SEARCH_DEBOUNCE_MS = 200;
export const UNDO_MS = 6000;
export const ROW_HEIGHT = 44;
export const ROW_HEIGHT_PHONE = 60;
const IDS_MAX = 1000;

/** Ids in chunks the selection accepts in one operation. */
function idOps(select: boolean, ids: string[]): ImportSelectionOp[] {
  const ops: ImportSelectionOp[] = [];
  for (let i = 0; i < ids.length; i += IDS_MAX)
    ops.push({ select, ids: ids.slice(i, i + IDS_MAX) });
  return ops;
}

/**
 * The Choose step: search, filters, the listed rows with their ticks, the running total and
 * every way to change the selection (a row, a range, all shown, clear with Undo). The rows
 * show each tick the moment it is made; the server hears about it a beat later.
 */
export function useContainerChooser(job: ImportJob, source: ImportSource | null) {
  const nouns = nounsOf(source);
  const toast = useOptionalToast();
  const narrow = useNarrow();
  const selection = useImportSelection(job.id);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilterState] = useState<ImportContainerFilter>('all');
  const [active, setActive] = useState(0);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [before, setBefore] = useState<BeforeClear>(new Map());
  const [undoable, setUndoable] = useState<{ run: () => void; toast: string | null } | null>(null);
  const list = useImportContainers(job.id, q, filter, selection);
  const listId = useId();
  // The site's own counts (no search), for the notices, kept while a search is on.
  const [siteCounts, setSiteCounts] = useState(list.counts);
  if (!q && list.counts && list.counts !== siteCounts) setSiteCounts(list.counts);

  const startOver = () => {
    setActive(0);
    setAnchor(null);
  };
  const search = (next: string) => {
    setQ(next);
    startOver();
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(text.trim());
      setActive(0);
      setAnchor(null);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const { ops } = selection;
  const rows = useMemo(() => overlayRows(list.rows, ops, before), [list.rows, ops, before]);
  const scope = useMemo(() => ({ ...(q ? { q } : {}), filter }), [q, filter]);
  const selectable = list.view?.selectable ?? 0;
  const ticked = list.view
    ? viewSelected(list.rows, ops, before, { ...list.view, seq: list.firstSeq }, scope)
    : 0;
  const head: boolean | 'mixed' = ticked === 0 ? false : ticked >= selectable ? true : 'mixed';
  const summary = selection.summary
    ? summaryNow(list.rows, ops, before, selection.summary, selection.summarySeq)
    : null;

  const offerUndo = useCallback(
    (title: string, back: ImportSelectionOp[]) => {
      const run = () => {
        selection.push(...back);
        setUndoable(null);
      };
      const id = toast?.undo({ title, onUndo: run }) ?? null;
      setUndoable({ run, toast: id });
    },
    [selection, toast],
  );
  useEffect(() => {
    if (!undoable) return;
    const timer = setTimeout(() => setUndoable(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undoable]);

  const clear = () => {
    if (!summary?.selected) return;
    setBefore(new Map(rows.map((row) => [row.id, row.selected])));
    selection.push({ clear: true });
    offerUndo(`Cleared ${plural(summary.selected, nouns)}`, [{ restore: true }]);
  };

  const toggle = (index: number, range = false) => {
    const row = rows[index];
    if (!row || row.access === 'none') return;
    const to = !row.selected;
    if (range && anchor !== null) {
      const [a, b] = [Math.min(anchor, index), Math.max(anchor, index)];
      const ids = rows
        .slice(a, b + 1)
        .filter((r) => r.access === 'ok')
        .map((r) => r.id);
      selection.push(...idOps(to, ids));
    } else selection.push({ select: to, ids: [row.id] });
    setAnchor(index);
    setActive(index);
  };

  const count = Math.max(list.total, rows.length);
  const moveTo = (index: number, extend = false) => {
    const next = Math.max(0, Math.min(count - 1, index));
    if (extend) {
      if (anchor === null) setAnchor(active);
      const row = rows[next];
      if (row && row.access === 'ok' && !row.selected)
        selection.push({ select: true, ids: [row.id] });
    }
    setActive(next);
  };

  return {
    nouns,
    site: job.discovery?.site ?? '',
    total: job.discovery?.total ?? 0,
    email: typeof job.connection['email'] === 'string' ? job.connection['email'] : null,
    text,
    q,
    filter,
    rows,
    count,
    view: list.view,
    counts: list.counts,
    siteCounts,
    loading: list.loading,
    error: list.error,
    refetch: list.refetch,
    setRange: list.setRange,
    head,
    summary,
    active,
    listId,
    focusList: () => document.getElementById(listId)?.focus(),
    rowHeight: narrow ? ROW_HEIGHT_PHONE : ROW_HEIGHT,
    narrow,
    setText,
    clearSearch: () => {
      setText('');
      search('');
    },
    setFilter: (next: ImportContainerFilter) => {
      setFilterState(next);
      startOver();
    },
    toggle,
    moveTo,
    setActive,
    /** Ticks every selectable row this search and filter shows, loaded or not. */
    selectAll: () => selection.push({ select: true, scope }),
    /** The header box: ticks all shown, or, when all are ticked, unticks them with Undo. */
    toggleAll: () => {
      if (head !== true) return selection.push({ select: true, scope });
      if (!q && (filter === 'all' || filter === 'selected')) return clear();
      selection.push({ select: false, scope });
      const back: ImportSelectionOp[] =
        filter === 'selected'
          ? idOps(
              true,
              rows.filter((r) => r.selected).map((r) => r.id),
            )
          : [{ select: true, scope }];
      offerUndo(`Cleared ${plural(ticked, nouns)}`, back);
    },
    clear,
    undo: () => {
      if (!undoable) return false;
      undoable.run();
      if (undoable.toast) toast?.dismiss(undoable.toast);
      return true;
    },
    /** Sends every waiting tick; the plan reads the selection the server holds. */
    flush: selection.flush,
  };
}

export type ContainerChooser = ReturnType<typeof useContainerChooser>;

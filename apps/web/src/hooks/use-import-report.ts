import type { ImportJob, ImportSource } from '@bemmoly/shared';
import { count, kindLabel, nounsOf, plural } from '../components/import/import-words.ts';
import { useImportRunRows, type RunRow } from './use-import-run.ts';

export interface ReportResult {
  tone: 'ok' | 'warn' | 'red';
  headline: string;
  body: string;
}

/** "23,373 issues, 41,902 comments and 6,118 attachments". */
function listed(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

const madeOf = (n: { created: number; updated: number }) => n.created + n.updated;

/** "1,840 issues updated · 2 skipped", "3,071 issues". */
export function rowSummary(row: RunRow, records: string): string {
  const n = row.progress.counts[records] ?? Object.values(row.progress.counts)[0];
  if (!n) return 'Done';
  const made =
    n.updated > 0 && n.created === 0
      ? `${count(n.updated)} ${records} updated`
      : `${count(madeOf(n))} ${records}`;
  return n.skipped > 0 ? `${made} · ${count(n.skipped)} skipped` : made;
}

function resultOf(job: ImportJob, rows: RunRow[], source: ImportSource | null): ReportResult {
  const nouns = nounsOf(source);
  const place = nouns.target.split(' ')[0] ?? 'Bemmoly';
  const failed = rows.filter((row) => row.progress.status === 'failed');
  const total = job.containers?.total ?? rows.length;
  if (job.status === 'completed_with_errors') {
    const done = total - (job.containers?.failed ?? failed.length);
    const who = failed.length === 1 ? failed[0]?.name : plural(failed.length, nouns);
    return {
      tone: 'warn',
      headline: `${count(done)} of ${plural(total, nouns)} imported.`,
      body: `${who ?? 'One'} stopped partway. What it brought in is kept; Retry carries on from where it stopped.`,
    };
  }
  if (job.status === 'completed') {
    const parts = Object.entries(job.report.counts)
      .map(([kind, n]) => `${count(madeOf(n))} ${kind}`)
      .slice(0, 3);
    const all = total > 0 ? `All ${plural(total, nouns)} imported.` : 'Import finished.';
    return {
      tone: 'ok',
      headline: all,
      body: parts.length ? `${listed(parts)} are in ${place}.` : '',
    };
  }
  if (job.status === 'cancelled') {
    return {
      tone: 'warn',
      headline: 'Import cancelled.',
      body: 'What it brought in is kept; Resume carries on from where it stopped.',
    };
  }
  return {
    tone: 'red',
    headline: 'The import stopped.',
    body: `${job.error ?? 'Something went wrong on the way.'} What it brought in is kept; Resume carries on from where it stopped.`,
  };
}

/**
 * The Done step: the result line, the four totals, one row per project or space (a failed one
 * first, with Retry), and the first skipped records.
 */
export function useImportReport(job: ImportJob, source: ImportSource | null) {
  const nouns = nounsOf(source);
  const runRows = useImportRunRows(job);
  const failed = runRows.rows.filter((row) => row.progress.status === 'failed');
  const kinds = [nouns.records, 'comments', 'attachments'].filter(
    (kind) => job.report.counts[kind],
  );
  const stats = [
    ...kinds.map((kind) => ({
      label: kindLabel(kind),
      value: madeOf(job.report.counts[kind] ?? { created: 0, updated: 0 }),
    })),
    { label: 'Skipped', value: job.report.skippedTotal },
  ];
  return {
    nouns,
    result: resultOf(job, runRows.rows, source),
    stats,
    rows: runRows.rows,
    hasMore: runRows.hasMore,
    loadingMore: runRows.loadingMore,
    loadMore: runRows.loadMore,
    rowsTotal: job.containers?.total ?? runRows.total,
    loading: runRows.loading,
    error: runRows.error,
    failed,
    /** Retry for every failed one, by id. */
    failedIds: failed.map((row) => row.id),
    canResume: job.status === 'failed' || job.status === 'cancelled',
    finished: job.status === 'completed' || job.status === 'completed_with_errors',
  };
}

export type ImportReportView = ReturnType<typeof useImportReport>;

import type { ImportJob, ImportSource } from '@bemmoly/shared';
import { Button, ProgressBar, SettingsSection, SkeletonText } from '@bemmoly/ui';
import { useId, useState } from 'react';
import { useImportRunRows, useRunEstimate, type RunRow } from '../../hooks/use-import-run.ts';
import { FormError } from '../form.tsx';
import { DisclosureButton } from './disclosure-button.tsx';
import { RunRowsMore } from './run-rows-more.tsx';
import { count, nounsOf } from './import-words.ts';
import { RunRowLine } from './run-row.tsx';

/** Rows shown before "Show N more". */
const FIRST = 5;

interface RunProgressProps {
  job: ImportJob;
  source: ImportSource | null;
  cancelling: boolean;
  onCancel: () => void;
}

const percentOf = (done: number, total: number) =>
  total > 0 ? Math.floor((done / total) * 100) : 0;

function phaseOf(row: RunRow) {
  const { status, phase, done, total } = row.progress;
  if (status === 'waiting') return 'Waiting';
  if (status === 'done') return 'Done';
  if (status === 'failed') return `Stopped at ${count(done)} of ${count(total)}`;
  return `${phase ?? 'Starting'}: ${count(done)} of ${count(total)}`;
}

function ProgressRow({ row }: { row: RunRow }) {
  const { status, done, total } = row.progress;
  return (
    <RunRowLine row={row} detail={phaseOf(row)}>
      <span className="flex items-center gap-3 max-sm:w-full max-sm:ps-7.5">
        <ProgressBar
          value={status === 'done' ? 100 : percentOf(done, total)}
          size="xs"
          fillClassName={status === 'done' ? 'bg-done' : status === 'failed' ? 'bg-red' : 'bg-prog'}
          label={`${row.name} progress`}
          className="w-30 max-sm:flex-1"
        />
        <span className="w-24 text-right font-mono text-12 text-tx-3 tabular-nums">
          {count(done)} / {count(total)}
        </span>
      </span>
    </RunRowLine>
  );
}

/**
 * A running import: one overall percentage with what is left, the overall bar, then one row
 * per project or space with its own bar. The headline is a polite live region.
 */
export function RunProgress({ job, source, cancelling, onCancel }: RunProgressProps) {
  const nouns = nounsOf(source);
  const runRows = useImportRunRows(job);
  const minutes = useRunEstimate(job);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const { done, total } = job.progress;
  const pct = percentOf(done, total);
  const left =
    minutes === null ? '' : ` · about ${minutes === 1 ? 'a minute' : `${minutes} minutes`} left`;
  const finished = job.containers?.done ?? 0;
  const of = job.containers?.total ?? runRows.total;
  const shown = open ? runRows.rows : runRows.rows.slice(0, FIRST);
  const more = Math.max(runRows.total, runRows.rows.length) - FIRST;
  return (
    <SettingsSection
      title="Progress"
      hint={of > 0 ? `${count(finished)} of ${count(of)} ${nouns.containers}` : undefined}
    >
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-24 font-semibold text-tx tabular-nums">{pct}%</span>
        <span aria-live="polite" className="text-13 text-tx-2 tabular-nums">
          {count(done)} of {count(total)} {nouns.records}
          {left}
        </span>
      </div>
      <ProgressBar value={pct} size="md" fillClassName="bg-prog" label="Import progress" />
      <FormError error={runRows.error} />
      {runRows.loading ? (
        <SkeletonText lines={3} />
      ) : (
        <div className="flex flex-col gap-2">
          <ul
            id={listId}
            aria-label={`${nouns.containers} in this import`}
            className="m-0 list-none p-0"
          >
            {shown.map((row) => (
              <ProgressRow key={row.id} row={row} />
            ))}
          </ul>
          {more > 0 ? (
            <DisclosureButton expanded={open} controls={listId} onToggle={() => setOpen(!open)}>
              {open ? 'Show fewer' : `Show ${count(more)} more`}
            </DisclosureButton>
          ) : null}
          {open && runRows.hasMore ? (
            <RunRowsMore
              left={runRows.total - runRows.rows.length}
              loading={runRows.loadingMore}
              onMore={runRows.loadMore}
            />
          ) : null}
        </div>
      )}
      <div className="-mx-4 -mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-4 py-3">
        <span className="text-12 text-tx-3">
          You can leave this page. Inbox tells you when it finishes.
        </span>
        <Button variant="secondary" className="ms-auto" loading={cancelling} onClick={onCancel}>
          Cancel import
        </Button>
      </div>
    </SettingsSection>
  );
}

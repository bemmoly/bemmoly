import { Icon, type IconName } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import type { RunRow } from '../../hooks/use-import-run.ts';

type RunStatus = RunRow['progress']['status'];

const MARKS: Record<RunStatus, { icon: IconName; tone: string; spoken: string }> = {
  done: { icon: 'circle-check', tone: 'text-done', spoken: 'Done' },
  running: { icon: 'refresh', tone: 'text-acc', spoken: 'Importing' },
  waiting: { icon: 'clock', tone: 'text-tx-3', spoken: 'Waiting' },
  failed: { icon: 'alert', tone: 'text-red', spoken: 'Stopped' },
};

interface RunRowLineProps {
  row: RunRow;
  /** Under the name: the phase, "Waiting", what it made, or why it stopped. */
  detail: ReactNode;
  /** Beside it: its own bar, Open board, or Retry. */
  children?: ReactNode;
}

/**
 * One project or space in a run: its state as a drawn icon (named for screen readers), name
 * and key, a line about it, and what goes with it. Rows stack their extras on a phone.
 */
export function RunRowLine({ row, detail, children }: RunRowLineProps) {
  const mark = MARKS[row.progress.status];
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line-2 py-2.5 first:border-t-0">
      <span className={`flex shrink-0 ${mark.tone}`}>
        <Icon name={mark.icon} size={18} />
        <span className="sr-only">{mark.spoken}:</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2 text-13">
          <span className="truncate font-semibold text-tx">{row.name}</span>
          {row.key ? <span className="font-mono text-12 text-tx-3">{row.key}</span> : null}
        </div>
        <div
          className={`text-12 ${row.progress.status === 'failed' ? 'text-red-tx' : 'text-tx-3'}`}
        >
          {detail}
        </div>
      </div>
      {children}
    </li>
  );
}

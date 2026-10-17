import type { ImportContainerRow } from '@bemmoly/shared';
import { Avatar, CheckboxMark, Skeleton } from '@bemmoly/ui';
import type { CSSProperties, MouseEvent } from 'react';
import { StatePill } from '../settings/state-pill.tsx';
import { count, shortDate, type ImportNouns } from './import-words.ts';

/** The columns: tick, key, name, type, lead (projects only), count, status. */
export function chooserColumns(withLead: boolean, narrow: boolean) {
  if (narrow) return 'grid-cols-[30px_minmax(0,1fr)_auto] grid-rows-2 content-center gap-x-2';
  return withLead
    ? 'grid-cols-[28px_78px_minmax(0,1fr)_110px_150px_84px_170px] items-center gap-x-2'
    : 'grid-cols-[28px_78px_minmax(0,1fr)_110px_84px_190px] items-center gap-x-2';
}

function Status({ row, nouns }: { row: ImportContainerRow; nouns: ImportNouns }) {
  if (row.access === 'none') {
    return (
      <StatePill tone="neutral" icon="lock">
        No access
      </StatePill>
    );
  }
  if (row.imported) {
    return (
      <StatePill tone="neutral" icon="refresh">
        Imported {shortDate(row.imported.at)}
        <span className="sr-only">; running again updates it</span>
      </StatePill>
    );
  }
  if (row.keyInUse) {
    return (
      <StatePill tone="warn">
        Key in use<span className="sr-only"> by a {nouns.target.toLowerCase()}</span>
      </StatePill>
    );
  }
  return null;
}

interface ChooserRowProps {
  id: string;
  row: ImportContainerRow;
  style: CSSProperties;
  active: boolean;
  withLead: boolean;
  narrow: boolean;
  nouns: ImportNouns;
  onPick: (event: MouseEvent) => void;
}

/** One project, space or file: its tick, what it is, how much is in it and what to know. */
export function ChooserRow({
  id,
  row,
  style,
  active,
  withLead,
  narrow,
  nouns,
  onPick,
}: ChooserRowProps) {
  const locked = row.access === 'none';
  const number = locked ? null : row.count === null ? (
    <span role="img" aria-label="Counting" className="inline-flex">
      <Skeleton width={38} height={8} shape="line" />
    </span>
  ) : (
    count(row.count)
  );
  return (
    <div
      id={id}
      role="option"
      aria-selected={row.selected}
      aria-disabled={locked || undefined}
      style={style}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPick}
      className={[
        'grid border-b border-line-2 px-4 text-13',
        chooserColumns(withLead, narrow),
        locked ? 'cursor-default text-tx-3' : 'cursor-pointer text-tx hover:bg-hover',
        row.selected ? 'bg-acc-50 hover:bg-acc-50' : '',
        active ? 'shadow-[inset_2px_0_0_var(--acc)]' : '',
      ].join(' ')}
    >
      <span className={narrow ? 'row-span-2 flex items-center' : 'flex items-center'}>
        <CheckboxMark checked={row.selected} disabled={locked} />
      </span>
      <span
        className={`truncate font-mono text-tx-2 ${narrow ? 'col-start-2 row-start-2 text-11' : 'text-12'}`}
      >
        {row.key}
      </span>
      <span
        className={`truncate ${locked ? 'font-normal' : 'font-medium'} ${narrow ? 'col-start-2 row-start-1 self-end' : ''}`}
      >
        {row.name}
      </span>
      {narrow ? null : <span className="truncate text-12 text-tx-2">{row.type}</span>}
      {withLead && !narrow ? (
        <span className="flex min-w-0 items-center gap-1.5 text-12 text-tx-2">
          {row.lead ? <Avatar name={row.lead} size={18} aria-hidden /> : null}
          <span className="truncate">{row.lead}</span>
        </span>
      ) : null}
      <span
        className={`text-end text-12 text-tx-2 tabular-nums ${narrow ? 'col-start-3 row-start-1 self-end' : ''}`}
      >
        {number}
      </span>
      <span className={`flex min-w-0 ${narrow ? 'col-start-3 row-start-2 justify-end' : ''}`}>
        <Status row={row} nouns={nouns} />
      </span>
    </div>
  );
}

/** A row not loaded yet: the same height and columns, in skeleton. */
export function ChooserRowSkeleton({
  style,
  withLead,
  narrow,
}: {
  style: CSSProperties;
  withLead: boolean;
  narrow: boolean;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={`grid border-b border-line-2 px-4 ${chooserColumns(withLead, narrow)}`}
    >
      <Skeleton width={14} height={14} shape="block" />
      <Skeleton width={40} height={10} />
      <Skeleton width="60%" height={10} />
    </div>
  );
}

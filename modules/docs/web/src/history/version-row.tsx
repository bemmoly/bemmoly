import { formatDateTime, formatRelative } from '@bemmoly/core-web';
import type { RevisionSummary } from '@bemmoly/module-docs/shared';
import { ActivityAction } from '@bemmoly/ui';
import { cx } from '../comments/cx.ts';
import { KIND_LABELS, revisionName } from './use-history.ts';

export interface VersionRowProps {
  revision: RevisionSummary;
  /** Who wrote it, by name, from the people the screen holds. */
  authors: string;
  selected: boolean;
  onSelect: () => void;
  onCompareNow: () => void;
  /** Absent on the oldest version. */
  onComparePrevious?: (() => void) | undefined;
  /** Absent for readers. */
  onRestore?: (() => void) | undefined;
}

const KIND_TONES: Record<RevisionSummary['kind'], string> = {
  named: 'bg-acc-50 text-acc',
  periodic: 'bg-line-2 text-tx-2',
  publish: 'bg-green-50 text-green-tx',
  restore: 'bg-violet-bg text-violet-fg',
};

/**
 * One version: its name, a small kind tag, when and who, and the word count. Selecting it
 * opens its actions underneath (compare with now, with the one before, restore), as a list
 * row that expands in place.
 */
export function VersionRow({
  revision,
  authors,
  selected,
  onSelect,
  onCompareNow,
  onComparePrevious,
  onRestore,
}: VersionRowProps) {
  return (
    <li
      className={cx(
        'flex flex-col rounded-control border motion-safe:transition-colors',
        selected ? 'border-acc-100 bg-acc-50' : 'border-transparent hover:bg-side',
      )}
    >
      <button
        type="button"
        data-version={revision.id}
        aria-expanded={selected}
        onClick={onSelect}
        className="flex cursor-pointer flex-col gap-1 rounded-control border-0 bg-transparent px-3 py-2 text-left font-sans text-13 text-tx outline-0 focus-visible:ring-2 focus-visible:ring-acc"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{revisionName(revision)}</span>
          <span
            className={cx(
              'shrink-0 rounded-chip px-1.25 py-px text-11 font-medium',
              KIND_TONES[revision.kind],
            )}
          >
            {KIND_LABELS[revision.kind]}
          </span>
        </span>
        <span className="truncate text-12 text-tx-3">
          <time dateTime={revision.createdAt} title={formatDateTime(revision.createdAt)}>
            {formatRelative(revision.createdAt)}
          </time>
          {authors ? ` · ${authors}` : ''} · {revision.wordCount}{' '}
          {revision.wordCount === 1 ? 'word' : 'words'}
        </span>
      </button>
      {selected && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-2.5 text-12 motion-safe:animate-fade-in">
          <ActivityAction className="font-medium text-acc!" onClick={onCompareNow}>
            Compare with now
          </ActivityAction>
          {onComparePrevious && (
            <ActivityAction className="font-medium" onClick={onComparePrevious}>
              Compare with previous
            </ActivityAction>
          )}
          {onRestore && (
            <ActivityAction className="ml-auto font-medium" onClick={onRestore}>
              Restore…
            </ActivityAction>
          )}
        </div>
      )}
    </li>
  );
}

import type { RevisionSummary } from '@bemmoly/module-docs/shared';
import { Avatar, avatarHue, Button, EmptyState, Input, RelativeTime, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { cx } from '../comments/cx.ts';
import { usePeople } from '../shared/people.ts';
import { revisionName } from './use-history.ts';

type Entry =
  | { kind: 'day'; label: string }
  | { kind: 'version'; revision: RevisionSummary }
  | { kind: 'autosaves'; revisions: RevisionSummary[] };

const dayLabel = (iso: string, now = new Date()) => {
  const date = new Date(iso);
  const days = Math.round(
    (new Date(now.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 86_400_000,
  );
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString('en', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
};

/** Versions grouped by day, newest first, with runs of autosaves folded into one line. */
export function timelineOf(revisions: readonly RevisionSummary[], now = new Date()): Entry[] {
  const entries: Entry[] = [];
  let day = '';
  for (const revision of revisions) {
    const label = dayLabel(revision.createdAt, now);
    if (label !== day) {
      entries.push({ kind: 'day', label });
      day = label;
    }
    const last = entries.at(-1);
    if (revision.kind === 'periodic' && last?.kind === 'autosaves') last.revisions.push(revision);
    else if (revision.kind === 'periodic')
      entries.push({ kind: 'autosaves', revisions: [revision] });
    else entries.push({ kind: 'version', revision });
  }
  return entries;
}

/** ↑↓ walk the version rows. */
function walkRows(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const rows = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-version]')];
  const index = rows.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  event.preventDefault();
  const next =
    rows[Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))];
  next?.focus();
  next?.click();
}

export interface VersionTimelineProps {
  revisions: readonly RevisionSummary[];
  selected: string | null;
  onSelect: (revision: RevisionSummary) => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  /** Absent for readers. */
  onName?: ((label: string) => Promise<unknown>) | undefined;
}

/**
 * The versions margin of the history mode: a timeline grouped by day, named versions as
 * filled dots, autosaves folded into one line that opens. Choosing a version compares it
 * with the page now. Name this version saves the page as it is, with a name.
 */
export function VersionTimeline(props: VersionTimelineProps) {
  const { revisions, selected, onSelect } = props;
  const { person } = usePeople();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [naming, setNaming] = useState(false);
  const [label, setLabel] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void props.onName?.(label.trim())?.then(() => {
      setNaming(false);
      setLabel('');
    });
  };
  const row = (revision: RevisionSummary, quiet = false) => {
    const author = revision.authorIds[0];
    const name = author ? (person(author)?.name ?? 'Someone') : null;
    return (
      <button
        key={revision.id}
        type="button"
        data-version={revision.id}
        aria-pressed={selected === revision.id}
        onClick={() => onSelect(revision)}
        className="flex w-full cursor-pointer items-start gap-2.5 rounded-card border-0 bg-transparent px-2.5 py-2 text-left font-sans text-13 text-tx hover:bg-hover focus-visible:shadow-ring focus-visible:outline-0 aria-pressed:bg-acc-50"
      >
        <span
          aria-hidden
          className={cx(
            'mt-1.5 size-2 shrink-0 rounded-full border-2 border-acc',
            !quiet && revision.kind !== 'periodic' && 'bg-acc',
          )}
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={cx('truncate', quiet ? 'font-normal' : 'font-semibold')}>
            {revisionName(revision)}
          </span>
          <span className="flex items-center gap-1.5 text-12 text-tx-3">
            {name && author && <Avatar name={name} hue={avatarHue(author)} size={16} />}
            {name && <span className="truncate">{name} ·</span>}
            <RelativeTime iso={revision.createdAt} />
            <span>· {revision.wordCount.toLocaleString('en')} words</span>
          </span>
        </span>
      </button>
    );
  };
  return (
    <aside
      aria-label="Versions"
      className="flex w-80 shrink-0 flex-col border-l border-line bg-canvas max-md:hidden"
    >
      <div className="flex h-11.5 shrink-0 items-center gap-2 border-b border-line pr-3 pl-4">
        <h2 className="m-0 flex-1 text-13 font-semibold text-tx">Versions</h2>
        {props.onName && !naming && (
          <Button
            size="sm"
            icon={<Icon name="bookmark" size={13} />}
            onClick={() => setNaming(true)}
          >
            Name this version
          </Button>
        )}
      </div>
      {naming && (
        <form onSubmit={submit} className="flex gap-1.5 border-b border-line p-3">
          <Input
            aria-label="Version name"
            placeholder="Before review"
            maxLength={120}
            autoFocus
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                setNaming(false);
              }
            }}
          />
          <Button type="submit" variant="primary" size="sm" disabled={!label.trim()}>
            Save
          </Button>
        </form>
      )}
      <div className="min-h-0 flex-1 overflow-auto px-2 py-1.5" onKeyDown={walkRows}>
        {props.loading ? (
          <div role="status" aria-label="Loading versions" className="flex flex-col gap-3 p-3">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} width="80%" />
            ))}
          </div>
        ) : props.error ? (
          <EmptyState
            size="sm"
            title="The history did not load"
            description="Check your connection and try again."
            action={
              <Button size="sm" onClick={props.onRetry}>
                Retry
              </Button>
            }
          />
        ) : revisions.length === 0 ? (
          <EmptyState
            size="sm"
            title="This is the first version"
            description="Changes will show here as people edit, publish and name versions."
          />
        ) : (
          timelineOf(revisions).map((entry, index) => {
            if (entry.kind === 'day')
              return (
                <h3
                  key={`day-${index}`}
                  className="m-0 px-2.5 pt-3 pb-1 text-12 font-semibold text-tx-3"
                >
                  {entry.label}
                </h3>
              );
            if (entry.kind === 'version') return row(entry.revision);
            const first = entry.revisions[0]!.id;
            const names = [...new Set(entry.revisions.flatMap((r) => r.authorIds))]
              .slice(0, 2)
              .map((id) => person(id)?.name ?? 'Someone');
            if (open.has(first) || entry.revisions.length === 1)
              return entry.revisions.map((revision) => row(revision, true));
            return (
              <button
                key={first}
                type="button"
                aria-expanded={false}
                onClick={() => setOpen(new Set([...open, first]))}
                className="flex w-full cursor-pointer items-center gap-2 rounded-card border-0 bg-transparent py-1.5 pr-2.5 pl-8 text-left font-sans text-13 text-tx-3 hover:bg-hover focus-visible:shadow-ring focus-visible:outline-0"
              >
                <Icon name="chevron" size={12} />
                {entry.revisions.length} autosaves{names.length ? ` · ${names.join(', ')}` : ''}
              </button>
            );
          })
        )}
        {props.hasMore && (
          <Button
            size="sm"
            variant="ghost"
            className="m-2"
            loading={props.loadingMore}
            onClick={props.onMore}
          >
            Show older versions
          </Button>
        )}
      </div>
    </aside>
  );
}

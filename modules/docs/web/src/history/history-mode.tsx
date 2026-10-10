import type { DiffStats, RevisionSummary } from '@bemmoly/module-docs/shared';
import { Button, EmptyState, Kbd, Select, Skeleton, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useEffect, useRef, useState } from 'react';
import { formatDateTime } from '@bemmoly/core-web';
import { DiffView } from './diff-view.tsx';
import {
  CURRENT,
  revisionName,
  useCompare,
  useRestoreWithUndo,
  useRevisions,
  useSaveVersion,
} from './use-history.ts';
import { VersionTimeline } from './version-timeline.tsx';

export interface HistoryModeProps {
  pageId: string;
  /** Naming and restoring need edit rights on the page; readers compare only. */
  canEdit?: boolean;
  onExit: () => void;
}

const CHIPS = [
  { key: 'inserted', word: 'added', tone: 'bg-green-50 text-green-tx' },
  { key: 'changed', word: 'edited', tone: 'bg-amber-50 text-amber-tx' },
  { key: 'deleted', word: 'removed', tone: 'bg-red-50 text-red-tx' },
  { key: 'moved', word: 'moved', tone: 'bg-violet-bg text-violet-fg' },
] as const;

/** "1 added · 1 edited · 1 removed" as chips in the signal colours. */
export function StatsLine({ stats }: { stats: DiffStats }) {
  const shown = CHIPS.filter((chip) => stats[chip.key] > 0);
  if (shown.length === 0) return <span className="text-12 text-tx-3">No changes</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {shown.map((chip) => (
        <span
          key={chip.key}
          className={`rounded-full px-2 py-0.5 text-12 font-medium tabular-nums ${chip.tone}`}
        >
          {stats[chip.key]} {chip.word}
        </span>
      ))}
    </span>
  );
}

/** J and K step through the changed blocks of the diff, as the review's "next change". */
function stepChange(root: HTMLElement | null, direction: 1 | -1) {
  if (!root) return;
  const rows = [
    ...root.querySelectorAll<HTMLElement>('[data-diff-row]:not([data-diff-row=equal])'),
  ];
  if (rows.length === 0) return;
  const view = root.getBoundingClientRect();
  const below = rows.findIndex((row) => row.getBoundingClientRect().top > view.top + 80);
  const index =
    direction === 1
      ? below < 0
        ? rows.length - 1
        : below
      : Math.max(0, (below < 0 ? rows.length : below) - 2);
  rows[index]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * Version history as a mode of the page, not a dialog: the page's place shows the diff of the
 * chosen version against the page now, with what you are comparing and the change counts on
 * a strip above, and the versions in the margin. Restore happens at once with Undo. Escape
 * or Exit goes back to the page.
 */
export function HistoryMode({ pageId, canEdit = true, onExit }: HistoryModeProps) {
  const history = useRevisions(pageId);
  const save = useSaveVersion(pageId);
  const { restore, pending } = useRestoreWithUndo(pageId);
  const toast = useToast();
  const { revisions } = history;
  const [picked, setPicked] = useState<string | null>(null);
  // The version before the latest save, which is the one most likely to show changes.
  const from = picked ?? (revisions[1] ?? revisions[0])?.id ?? null;
  const compare = useCompare(pageId, from, CURRENT);
  const scroller = useRef<HTMLDivElement>(null);
  const chosen = revisions.find((revision) => revision.id === from);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') onExit();
      else if (!typing(event.target) && (event.key === 'j' || event.key === 'k'))
        stepChange(scroller.current, event.key === 'j' ? 1 : -1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExit]);

  const options = revisions.map((revision) => ({
    value: revision.id,
    label: `${revisionName(revision)} · ${formatDateTime(revision.createdAt)}`,
  }));
  const pick = (revision: RevisionSummary) => setPicked(revision.id);

  return (
    <div className="flex min-h-0 flex-1" data-history-mode>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2.5 border-b border-line bg-sunken px-6 py-2">
          <Icon name="clock" size={14} className="text-tx-3" />
          <h2 className="m-0 text-13 font-semibold text-tx">Version history</h2>
          {options.length > 0 && from && (
            <Select
              aria-label="Version to compare"
              size="sm"
              className="w-64 max-w-full"
              options={options}
              value={from}
              onChange={(event) => setPicked(event.value)}
            />
          )}
          <Icon name="arrow" size={14} className="text-tx-3" />
          <span className="text-12h text-tx-2">Current version</span>
          {compare.data && <StatsLine stats={compare.data.diff.stats} />}
          <span className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1 text-12 text-tx-3 lg:flex">
              <Kbd keys="J" />
              <Kbd keys="K" />
              next change
            </span>
            <Button size="sm" variant="ghost" iconEnd={<Kbd keys="Escape" />} onClick={onExit}>
              Exit
            </Button>
            {canEdit && chosen && (
              <Button
                size="sm"
                variant="primary"
                loading={pending}
                icon={<Icon name="undo" size={14} />}
                onClick={() => void restore(chosen, onExit)}
              >
                Restore this version
              </Button>
            )}
          </span>
        </div>
        <div ref={scroller} className="min-h-0 flex-1 overflow-auto bg-canvas">
          <div className="mx-auto max-w-[780px] px-4 pt-8 pb-24 sm:px-10">
            {history.isPending || (from && compare.isPending) ? (
              <div role="status" aria-label="Loading the changes" className="flex flex-col gap-3">
                <Skeleton width="70%" />
                <Skeleton width="90%" />
                <Skeleton width="55%" />
              </div>
            ) : !from ? (
              <EmptyState
                title="This is the first version"
                description="Changes will show here as people edit the page."
              />
            ) : compare.isError ? (
              <EmptyState
                title="These changes did not load"
                description="The version may be gone. Pick another one, or try again."
                action={<Button onClick={() => void compare.refetch()}>Retry</Button>}
              />
            ) : compare.data ? (
              <DiffView diff={compare.data.diff} />
            ) : null}
          </div>
        </div>
      </div>
      <VersionTimeline
        revisions={revisions}
        selected={from}
        onSelect={pick}
        loading={history.isPending}
        error={history.isError}
        onRetry={() => void history.refetch()}
        hasMore={history.hasNextPage}
        loadingMore={history.isFetchingNextPage}
        onMore={() => void history.fetchNextPage()}
        onName={
          canEdit
            ? (label) =>
                save.mutateAsync(label || undefined).then(
                  (revision) => {
                    setPicked(revision.id);
                    toast.show({
                      tone: 'ok',
                      title: `Saved ${revisionName(revision)}`,
                      duration: 3000,
                    });
                  },
                  (error: Error) =>
                    toast.show({
                      tone: 'danger',
                      title: 'The version was not saved',
                      body: error.message,
                    }),
                )
            : undefined
        }
      />
    </div>
  );
}

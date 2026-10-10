import { formatDateTime } from '@bemmoly/core-web';
import type { DiffStats, RevisionSummary } from '@bemmoly/module-docs/shared';
import { Button, EmptyState, Modal, Select, Skeleton } from '@bemmoly/ui';
import { DiffView } from './diff-view.tsx';
import { CURRENT, revisionName, useCompare } from './use-history.ts';

export interface CompareSelection {
  from: string;
  to: string;
}

export interface CompareDialogProps {
  pageId: string;
  revisions: readonly RevisionSummary[];
  selection: CompareSelection | null;
  onChange: (selection: CompareSelection) => void;
  onClose: () => void;
  /** Restore the older side; absent for readers. */
  onRestore?: ((revision: RevisionSummary) => void) | undefined;
}

const versionLabel = (revision: RevisionSummary) =>
  `${revisionName(revision)} · ${formatDateTime(revision.createdAt)}`;

/** "2 added · 1 removed · 3 edited · 1 moved", each in its op's colour. */
export function StatsLine({ stats }: { stats: DiffStats }) {
  const parts = [
    { n: stats.inserted, word: 'added', tone: 'bg-ok' },
    { n: stats.deleted, word: 'removed', tone: 'bg-danger' },
    { n: stats.changed, word: 'edited', tone: 'bg-caution' },
    { n: stats.moved, word: 'moved', tone: 'bg-epic-2' },
  ].filter((part) => part.n > 0);
  if (parts.length === 0) return <span className="text-tx5">No changes</span>;
  return (
    <span className="flex flex-wrap items-center gap-3">
      {parts.map((part) => (
        <span key={part.word} className="flex items-center gap-1.5">
          <span aria-hidden className={`size-2 rounded-tick ${part.tone}`} />
          {part.n} {part.word}
        </span>
      ))}
    </span>
  );
}

/**
 * Two versions side by side in one column: pick any version on the left and any version or
 * the page as it is now on the right, read the newer one with every change marked. Restore
 * from here takes the left side back.
 */
export function CompareDialog({
  pageId,
  revisions,
  selection,
  onChange,
  onClose,
  onRestore,
}: CompareDialogProps) {
  const compare = useCompare(pageId, selection?.from ?? null, selection?.to ?? CURRENT);
  const options = revisions.map((revision) => ({
    value: revision.id,
    label: versionLabel(revision),
    description: `${revision.wordCount} words`,
  }));
  const fromRevision = revisions.find((revision) => revision.id === selection?.from);
  return (
    <Modal
      open={selection !== null}
      onClose={onClose}
      width="xl"
      className="h-[calc(100vh-96px)]"
      title="Compare versions"
      description="The newer side, with what changed since the older side marked in place."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {onRestore && fromRevision && (
            <Button variant="secondary" onClick={() => onRestore(fromRevision)}>
              Restore {revisionName(fromRevision)}
            </Button>
          )}
        </>
      }
    >
      {selection && (
        <div className="flex min-h-full flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-12h text-tx3">
            <Select
              aria-label="Older version"
              size="sm"
              className="min-w-0 flex-1"
              options={options}
              value={selection.from}
              onChange={(event) => onChange({ ...selection, from: event.value })}
            />
            <span aria-hidden className="text-tx5">
              →
            </span>
            <Select
              aria-label="Newer version"
              size="sm"
              className="min-w-0 flex-1"
              options={[{ value: CURRENT, label: 'The page now' }, ...options]}
              value={selection.to}
              onChange={(event) => onChange({ ...selection, to: event.value })}
            />
          </div>
          <div className="flex items-center border-b border-br-row pb-2 text-12 text-tx3">
            {compare.data ? (
              <StatsLine stats={compare.data.diff.stats} />
            ) : (
              <Skeleton width={160} />
            )}
          </div>
          {selection.from === selection.to ? (
            <EmptyState
              title="Pick two different versions"
              description="Both sides are the same version."
            />
          ) : compare.isPending ? (
            <div role="status" className="flex flex-col gap-3" aria-label="Loading the compare">
              <Skeleton width="70%" />
              <Skeleton width="90%" />
              <Skeleton width="55%" />
            </div>
          ) : compare.isError ? (
            <EmptyState
              title="This compare could not be loaded"
              description="One of the versions may be gone. Try another pair."
              action={<Button onClick={() => void compare.refetch()}>Try again</Button>}
            />
          ) : (
            <DiffView diff={compare.data.diff} className="pb-6" />
          )}
        </div>
      )}
    </Modal>
  );
}

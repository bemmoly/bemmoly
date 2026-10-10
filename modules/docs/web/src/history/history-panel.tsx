import type { RevisionSummary } from '@bemmoly/module-docs/shared';
import { Button, EmptyState, Input, Skeleton, useToast } from '@bemmoly/ui';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { usePeople } from '../shared/people.ts';
import { CompareDialog, type CompareSelection } from './compare-dialog.tsx';
import { RestoreDialog } from './restore-dialog.tsx';
import {
  CURRENT,
  revisionName,
  useRestoreVersion,
  useRevisions,
  useSaveVersion,
} from './use-history.ts';
import { VersionRow } from './version-row.tsx';

export interface HistoryPanelProps {
  pageId: string;
  /** Saving and restoring need edit rights on the page; readers compare only. */
  canEdit?: boolean;
}

const LABEL = 'text-11 font-medium tracking-caps text-tx5 uppercase';

/** Arrow keys walk the version rows. */
function walkRows(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const rows = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-version]')];
  const index = rows.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  event.preventDefault();
  const next = index + (event.key === 'ArrowDown' ? 1 : -1);
  rows[Math.max(0, Math.min(rows.length - 1, next))]?.focus();
}

/**
 * A page's version history for the side panel: save a version (optionally named), the
 * versions newest first, and for the one picked, compare it with the page now or with the
 * version before, or restore it after a confirmation. The compare opens over the page.
 */
export function HistoryPanel({ pageId, canEdit = true }: HistoryPanelProps) {
  const history = useRevisions(pageId);
  const save = useSaveVersion(pageId);
  const restore = useRestoreVersion(pageId);
  const { person } = usePeople();
  const toast = useToast();
  const [naming, setNaming] = useState(false);
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<CompareSelection | null>(null);
  const [restoring, setRestoring] = useState<RevisionSummary | null>(null);
  const { revisions } = history;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(label.trim() || undefined, {
      onSuccess: (revision) => {
        setNaming(false);
        setLabel('');
        setSelected(revision.id);
        toast.show({ tone: 'ok', title: `Saved ${revisionName(revision)}`, duration: 3000 });
      },
      onError: (error) =>
        toast.show({ tone: 'danger', title: 'The version was not saved', body: error.message }),
    });
  };

  const confirmRestore = (revision: RevisionSummary) =>
    restore.mutate(revision.id, {
      onSuccess: () => {
        setRestoring(null);
        setCompare(null);
        toast.show({
          tone: 'ok',
          title: `Restored ${revisionName(revision)}`,
          body: 'Saved as a new version at the top of the history.',
        });
      },
      onError: (error) =>
        toast.show({ tone: 'danger', title: 'The version was not restored', body: error.message }),
    });

  const authorsOf = (revision: RevisionSummary) =>
    revision.authorIds
      .slice(0, 2)
      .map((id) => person(id)?.name ?? 'Someone')
      .join(', ') + (revision.authorIds.length > 2 ? ` +${revision.authorIds.length - 2}` : '');

  return (
    <div className="flex min-h-0 flex-1 flex-col text-12h leading-body">
      <div className="flex shrink-0 items-center gap-2 px-3.5 pt-3.5 pb-2">
        <span className={LABEL}>Version history</span>
        {canEdit && !naming && (
          <Button size="xs" variant="secondary" className="ml-auto" onClick={() => setNaming(true)}>
            Save version
          </Button>
        )}
      </div>
      {naming && (
        <form onSubmit={submit} className="flex shrink-0 flex-col gap-2 px-3.5 pb-3">
          <Input
            aria-label="Version name"
            placeholder="Name this version (optional)"
            maxLength={120}
            autoFocus
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && setNaming(false)}
          />
          <span className="flex justify-end gap-1.5">
            <Button size="xs" variant="ghost" onClick={() => setNaming(false)}>
              Cancel
            </Button>
            <Button size="xs" variant="primary" type="submit" loading={save.isPending}>
              Save
            </Button>
          </span>
        </form>
      )}
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-3.5">
        {history.isPending ? (
          <div role="status" className="flex flex-col gap-3 px-3 py-2" aria-label="Loading versions">
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Skeleton width="55%" />
                <Skeleton width="80%" />
              </div>
            ))}
          </div>
        ) : history.isError ? (
          <EmptyState
            size="sm"
            title="The history could not be loaded"
            description="Check your connection and try again."
            action={
              <Button size="sm" onClick={() => void history.refetch()}>
                Try again
              </Button>
            }
          />
        ) : revisions.length === 0 ? (
          <EmptyState
            size="sm"
            title="No versions yet"
            description="Versions are kept as people edit, when the page is published, and whenever someone saves one."
          />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0" onKeyDown={walkRows}>
            {revisions.map((revision, index) => {
              const previous = revisions[index + 1];
              return (
                <VersionRow
                  key={revision.id}
                  revision={revision}
                  authors={authorsOf(revision)}
                  selected={selected === revision.id}
                  onSelect={() => setSelected(selected === revision.id ? null : revision.id)}
                  onCompareNow={() => setCompare({ from: revision.id, to: CURRENT })}
                  onComparePrevious={
                    previous ? () => setCompare({ from: previous.id, to: revision.id }) : undefined
                  }
                  onRestore={canEdit ? () => setRestoring(revision) : undefined}
                />
              );
            })}
          </ul>
        )}
        {history.hasNextPage && (
          <Button
            size="xs"
            variant="ghost"
            className="mx-3 mt-2"
            loading={history.isFetchingNextPage}
            onClick={() => void history.fetchNextPage()}
          >
            Show older versions
          </Button>
        )}
      </div>
      <CompareDialog
        pageId={pageId}
        revisions={revisions}
        selection={compare}
        onChange={setCompare}
        onClose={() => setCompare(null)}
        onRestore={canEdit ? setRestoring : undefined}
      />
      <RestoreDialog
        revision={restoring}
        busy={restore.isPending}
        onConfirm={confirmRestore}
        onClose={() => setRestoring(null)}
      />
    </div>
  );
}

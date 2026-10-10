import { TRASH_RETENTION_DAYS, type TrashItem } from '@bemmoly/module-docs/shared';
import { Button, ConfirmChange, EmptyState, Input, Kbd, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '../hooks/use-media-query.ts';
import { useSpaceActions } from './space-layout.tsx';
import { TrashPeek } from './trash/trash-peek.tsx';
import { TrashTable } from './trash/trash-table.tsx';
import {
  pageTitle,
  useCanPurge,
  useDeleteForever,
  useEmptyTrash,
  useRestore,
  useTrash,
} from './trash/use-trash.ts';

function TrashSkeleton() {
  return (
    <div
      role="status"
      className="flex flex-col rounded-card border border-br bg-sf"
      aria-label="Loading the trash"
    >
      {[48, 36, 42].map((width) => (
        <div
          key={width}
          className="flex items-center gap-3 border-b border-br-row px-3 py-3.5 last:border-b-0"
        >
          <Skeleton width={16} height={16} />
          <Skeleton width={`${width}%`} height={11} />
        </div>
      ))}
    </div>
  );
}

/** "/" lands in the trash search, unless the person is already typing somewhere. */
function useSlashToSearch(field: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== '/' || target?.closest('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      field.current?.focus();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [field]);
}

/**
 * A space's trash at /docs/s/:key/trash. Pages stay 30 days, then the purge job deletes them.
 * Restore happens at once; Delete forever and Empty trash ask with a typed confirmation, and
 * only space and workspace admins see them.
 */
export function TrashView() {
  const { space } = useSpaceActions();
  const trash = useTrash(space.key);
  const canPurge = useCanPurge(space.key);
  const wide = useMediaQuery('(min-width: 1180px)');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<TrashItem | null>(null);
  const [purging, setPurging] = useState<TrashItem | null>(null);
  const [emptying, setEmptying] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  useSlashToSearch(search);

  const clear = (page: TrashItem) => setSelected((open) => (open?.id === page.id ? null : open));
  const restore = useRestore(clear);
  const purge = useDeleteForever(space.key, (page) => {
    clear(page);
    setPurging(null);
  });
  const empty = useEmptyTrash(space.key, () => {
    setSelected(null);
    setEmptying(false);
  });

  const all = trash.data?.pages.flatMap((page) => page.items) ?? [];
  const needle = query.trim().toLowerCase();
  const pages = needle ? all.filter((page) => pageTitle(page).toLowerCase().includes(needle)) : all;
  const inside = all.reduce((sum, page) => sum + page.pagesInside, 0);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <div className="mx-auto flex max-w-260 flex-col gap-4 px-4 pt-7 pb-15 md:px-8">
          <header className="flex flex-wrap items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h1 className="m-0 text-24 font-semibold tracking-display text-tx">Trash</h1>
              <p className="m-0 text-13h text-tx4">
                Pages stay here for {TRASH_RETENTION_DAYS} days, then they’re deleted for good.
                Restoring a page brings back the pages under it.
              </p>
            </div>
            {canPurge && all.length > 0 && (
              <Button
                variant="ghost"
                className="text-danger! enabled:hover:text-danger!"
                icon={<Icon name="trash" size={14} />}
                onClick={() => setEmptying(true)}
              >
                Empty trash
              </Button>
            )}
          </header>
          {all.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                ref={search}
                type="search"
                aria-label="Search the trash"
                placeholder="Search the trash…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                prefix={<Icon name="search" size={14} />}
                suffix={<Kbd keys="/" />}
                wrapperClassName="w-full sm:w-64"
              />
              <span className="ml-auto text-12 text-tx5 tabular-nums">
                {all.length} {all.length === 1 ? 'page' : 'pages'}
                {inside > 0 && ` · ${inside} more under them`}
              </span>
            </div>
          )}
          {trash.isPending ? (
            <TrashSkeleton />
          ) : trash.isError ? (
            <EmptyState
              icon={<Icon name="warning" />}
              title="The trash didn’t load"
              description="Nothing in it was changed. Check your connection and try again."
              action={<Button onClick={() => void trash.refetch()}>Try again</Button>}
            />
          ) : all.length === 0 ? (
            <EmptyState
              icon={<Icon name="trash" />}
              title="Nothing in the trash"
              description={`Deleted pages stay here for ${TRASH_RETENTION_DAYS} days.`}
            />
          ) : pages.length === 0 ? (
            <p className="m-0 py-8 text-center text-13 text-tx4">
              Nothing in the trash matches “{query.trim()}”.
            </p>
          ) : (
            <TrashTable
              pages={pages}
              spaceName={space.name}
              selectedId={selected?.id ?? null}
              canPurge={canPurge}
              restoringId={restore.isPending ? (restore.variables?.id ?? null) : null}
              onPreview={setSelected}
              onRestore={(page) => restore.mutate(page)}
              onDeleteForever={setPurging}
            />
          )}
          {trash.hasNextPage && (
            <Button
              variant="ghost"
              loading={trash.isFetchingNextPage}
              onClick={() => void trash.fetchNextPage()}
            >
              Show more
            </Button>
          )}
          {canPurge && all.length > 0 && (
            <p className="m-0 text-12 text-tx5">
              Deleting forever can’t be undone. Only space admins can empty the trash.
            </p>
          )}
        </div>
      </div>
      <TrashPeek
        page={selected}
        variant={wide ? 'docked' : 'overlay'}
        canPurge={canPurge}
        restoring={restore.isPending && restore.variables?.id === selected?.id}
        onRestore={(page) => restore.mutate(page)}
        onDeleteForever={setPurging}
        onClose={() => setSelected(null)}
      />
      <ConfirmChange
        open={Boolean(purging)}
        title={`Delete “${purging ? pageTitle(purging) : ''}” forever?`}
        consequences={[
          purging?.pagesInside
            ? `The page and the ${purging.pagesInside} ${purging.pagesInside === 1 ? 'page' : 'pages'} under it are deleted for good.`
            : 'The page is deleted for good.',
          'Its comments and history go with it. This can’t be undone.',
        ]}
        confirmWord="delete"
        confirmLabel="Delete forever"
        busy={purge.isPending}
        error={purge.error?.message}
        onConfirm={() => purging && purge.mutate(purging)}
        onCancel={() => setPurging(null)}
      />
      <ConfirmChange
        open={emptying}
        title={`Empty the trash in ${space.name}?`}
        consequences={[
          `All ${all.length + inside} ${all.length + inside === 1 ? 'page' : 'pages'} in the trash are deleted for good.`,
          'Their comments and history go with them. This can’t be undone.',
        ]}
        confirmWord={space.key}
        confirmLabel="Empty trash"
        busy={empty.isPending}
        error={empty.error?.message}
        onConfirm={() => empty.mutate()}
        onCancel={() => setEmptying(false)}
      />
    </div>
  );
}

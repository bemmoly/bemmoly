import { formatRelative } from '@bemmoly/core-web';
import type { PageSummary } from '@bemmoly/module-docs/shared';
import { Button, Card, EmptyState, Skeleton, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';
import { docsPaths, navigateTo } from '../shared/navigation.ts';
import { useSpaceActions } from './space-layout.tsx';

function useTrash(spaceKey: string) {
  return useInfiniteQuery({
    queryKey: docsKeys.trash(spaceKey),
    queryFn: ({ pageParam }) =>
      api.docs.spaces.trash(spaceKey, { limit: 50, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

function useRestore() {
  const queryClient = useQueryClient();
  const { show } = useToast();
  return useMutation({
    mutationFn: (page: PageSummary) => api.docs.pages.restore(page.id),
    onSuccess: (page) =>
      show({
        tone: 'ok',
        title: `“${page.title || 'Untitled'}” restored`,
        action: { label: 'Open', onClick: () => navigateTo(docsPaths.page(page.id)) },
      }),
    onError: (error) => show({ tone: 'danger', title: 'Not restored', body: error.message }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: docsKeys.all() }),
  });
}

/**
 * A space's trash at /docs/s/:key/trash: pages moved there, newest first, each restorable
 * to where it was (or to the top of the space when its parent is gone too). Pages under a
 * trashed page come back with it.
 */
export function TrashView() {
  const { space } = useSpaceActions();
  const trash = useTrash(space.key);
  const restore = useRestore();
  const pages = trash.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto flex max-w-225 flex-col gap-5 px-5 pt-8 pb-15 md:px-10">
        <header className="flex flex-col gap-1">
          <h1 className="m-0 text-24 font-semibold tracking-display text-tx">Trash</h1>
          <p className="m-0 text-13h text-tx4">
            Pages moved to the trash in {space.name}. Restoring a page brings back the pages under
            it.
          </p>
        </header>
        {trash.isPending ? (
          <Card className="flex flex-col gap-3 p-4" aria-hidden>
            {[60, 45, 52].map((width) => (
              <Skeleton key={width} width={`${width}%`} height={12} />
            ))}
          </Card>
        ) : trash.isError ? (
          <EmptyState title="The trash could not be loaded" description={trash.error.message} />
        ) : pages.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icon name="trash" />}
              title="The trash is empty"
              description="Pages you move to the trash wait here until you restore them."
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <ul aria-label="Pages in the trash" className="m-0 list-none p-0">
              {pages.map((page) => (
                <li
                  key={page.id}
                  className="flex items-center gap-3 border-b border-br-row px-4 py-2.5 last:border-b-0"
                >
                  <Icon name="doc" className="text-tx5" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-13 font-medium text-tx">
                      {page.title || 'Untitled'}
                    </span>
                    <span className="text-12 text-tx5">
                      Moved to trash {page.deletedAt ? formatRelative(page.deletedAt) : ''}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Icon name="restore" size={14} />}
                    loading={restore.isPending && restore.variables?.id === page.id}
                    onClick={() => restore.mutate(page)}
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
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
      </div>
    </div>
  );
}

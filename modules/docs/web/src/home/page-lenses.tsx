import type { HomePage, Space } from '@bemmoly/module-docs/shared';
import { Button, Card, DocListRowSkeleton, EmptyState, SegmentedControl } from '@bemmoly/ui';
import { useEffect } from 'react';
import { busyTarget } from '../create/use-new-page-key.ts';
import { useAttention, useMyDrafts } from '../hooks/home-queries.ts';
import { useRecentPages, useStarredPages } from '../hooks/queries.ts';
import type { DocsPersonView } from '../shared/people.ts';
import { moveInList, PageRow, SpaceMark } from './page-row.tsx';

export type Lens = 'recent' | 'starred' | 'drafts' | 'review';

export const LENSES: readonly Lens[] = ['recent', 'starred', 'drafts', 'review'];

const EMPTY: Record<Lens, { title: string; description: string }> = {
  recent: {
    title: 'Nothing edited yet',
    description: 'Pages you and your team write show up here, newest first.',
  },
  starred: {
    title: 'No starred pages',
    description: 'Star a page from its header or its row menu to keep it one click away.',
  },
  drafts: {
    title: 'No drafts',
    description: 'Your pages still in draft or in review wait here until they are published.',
  },
  review: {
    title: 'Nothing to review',
    description: 'When someone asks you to review a page, it waits here.',
  },
};

interface LensData {
  pages: readonly HomePage[];
  pending: boolean;
  error: boolean;
  retry: () => void;
}

export interface PageLensesProps {
  lens: Lens;
  onLens: (lens: Lens) => void;
  spaces: ReadonlyMap<string, Space>;
  person: (id: string | null) => DocsPersonView | null;
}

/**
 * One list, four lenses: Recent, Starred, My drafts and For review, as a segmented control
 * over the same rows (1–4 switch). "Shared with me" in the review is For review here: pages
 * carry no per-person sharing, and review requests are what is truly asked of the person.
 */
export function PageLenses({ lens, onLens, spaces, person }: PageLensesProps) {
  const recent = useRecentPages();
  const starred = useStarredPages();
  const drafts = useMyDrafts(lens === 'drafts');
  const attention = useAttention();
  const reviews = (attention.data?.items ?? []).filter((item) => item.kind === 'review');

  const data: Record<Lens, LensData> = {
    recent: {
      pages: recent.data?.pages.flatMap((page) => page.items) ?? [],
      pending: recent.isPending,
      error: recent.isError,
      retry: () => void recent.refetch(),
    },
    starred: {
      pages: starred.data?.pages.flatMap((page) => page.items) ?? [],
      pending: starred.isPending,
      error: starred.isError,
      retry: () => void starred.refetch(),
    },
    drafts: {
      pages: drafts.drafts as HomePage[],
      pending: drafts.isPending,
      error: drafts.isError,
      retry: () => void recent.refetch(),
    },
    review: {
      pages: reviews.map((item) => item.page as HomePage),
      pending: attention.isPending,
      error: attention.isError,
      retry: () => void attention.refetch(),
    },
  };
  const count = (key: Lens) => (data[key].pending ? '' : ` · ${data[key].pages.length}`);
  const options = [
    { value: 'recent' as const, label: 'Recent' },
    { value: 'starred' as const, label: `Starred${count('starred')}` },
    { value: 'drafts' as const, label: `My drafts${count('drafts')}` },
    { value: 'review' as const, label: `For review${count('review')}` },
  ];
  const list = data[lens];
  const more = lens === 'recent' ? recent : lens === 'starred' ? starred : null;

  // 1–4 pick a lens, unless the person is typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || busyTarget(event.target)) return;
      const next = LENSES[Number(event.key) - 1];
      if (next) onLens(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onLens]);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 overflow-x-auto border-b border-br2 px-3.5 py-2.5">
        <SegmentedControl
          size="sm"
          aria-label="Which pages"
          options={options}
          value={lens}
          onChange={onLens}
        />
      </div>
      <div role="list" aria-label="Pages" onKeyDown={moveInList}>
        {list.pending ? (
          <DocListRowSkeleton rows={6} />
        ) : list.error ? (
          <EmptyState
            size="sm"
            title="This list didn’t load"
            description="The rest of the page still works."
            action={
              <Button size="sm" onClick={list.retry}>
                Try again
              </Button>
            }
          />
        ) : list.pages.length === 0 ? (
          <EmptyState size="sm" {...EMPTY[lens]} />
        ) : (
          list.pages.map((page) => {
            const space = spaces.get(page.spaceId);
            return (
              <div role="listitem" key={page.id}>
                <PageRow
                  page={page}
                  place={
                    space ? (
                      <>
                        <SpaceMark space={space} size={14} />
                        <span className="truncate">{space.name}</span>
                      </>
                    ) : (
                      page.spaceKey
                    )
                  }
                  person={page.lastEditor ?? person(page.ownerId)}
                  when={page.updatedAt}
                />
              </div>
            );
          })
        )}
      </div>
      {more?.hasNextPage && (
        <div className="flex justify-center border-t border-br-row py-1.5">
          <Button
            size="sm"
            variant="ghost"
            loading={more.isFetchingNextPage}
            onClick={() => void more.fetchNextPage()}
          >
            Show more
          </Button>
        </div>
      )}
    </Card>
  );
}

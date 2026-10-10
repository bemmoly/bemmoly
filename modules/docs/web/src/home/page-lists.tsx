import { formatRelative } from '@bemmoly/core-web';
import type { PageSummary, Space } from '@bemmoly/module-docs/shared';
import {
  Button,
  Card,
  DocListRow,
  DocListRowSkeleton,
  EmptyState,
  PAGE_STATUS_LABELS,
  TabPanel,
  Tabs,
} from '@bemmoly/ui';
import { useState } from 'react';
import { useMyDrafts } from '../hooks/home-queries.ts';
import { useRecentPages, useStarredPages } from '../hooks/queries.ts';
import { docsPaths } from '../shared/navigation.ts';
import type { DocsPersonView } from '../shared/people.ts';

type ListTab = 'recent' | 'starred' | 'drafts';

const TABS: { value: ListTab; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'starred', label: 'Starred' },
  { value: 'drafts', label: 'Drafts' },
];

const EMPTY: Record<ListTab, { title: string; description: string }> = {
  recent: {
    title: 'Nothing edited yet',
    description: 'Pages you and your team write show up here, newest first.',
  },
  starred: {
    title: 'No starred pages',
    description: 'Star a page from its menu in the space sidebar to keep it one click away.',
  },
  drafts: {
    title: 'No drafts',
    description: 'Your pages still in draft or in review wait here until they are published.',
  },
};

export interface PageListsProps {
  spaces: ReadonlyMap<string, Space>;
  person: (id: string | null) => DocsPersonView | null;
}

/**
 * The Docs mock's list card: Recent, Starred and Drafts tabs over rows of pages, each with
 * where it lives, its owner and when it last changed. Drafts are the person's own pages
 * in draft or in review, and say which.
 */
export function PageLists({ spaces, person }: PageListsProps) {
  const [tab, setTab] = useState<ListTab>('recent');
  const recent = useRecentPages();
  const starred = useStarredPages();
  const drafts = useMyDrafts(tab === 'drafts');
  const lists: Record<ListTab, { pages: PageSummary[]; pending: boolean; error: boolean }> = {
    recent: {
      pages: recent.data?.pages.flatMap((page) => page.items) ?? [],
      pending: recent.isPending,
      error: recent.isError,
    },
    starred: {
      pages: starred.data?.pages.flatMap((page) => page.items) ?? [],
      pending: starred.isPending,
      error: starred.isError,
    },
    drafts: { pages: drafts.drafts, pending: drafts.isPending, error: drafts.isError },
  };
  const list = lists[tab];
  const more = tab === 'recent' ? recent : tab === 'starred' ? starred : null;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line-2 px-4">
        <Tabs
          size="sm"
          bordered={false}
          idPrefix="docs-lists"
          value={tab}
          onChange={setTab}
          items={TABS}
        />
      </div>
      <TabPanel idPrefix="docs-lists" value={tab}>
        {list.pending ? (
          <DocListRowSkeleton rows={6} />
        ) : list.error ? (
          <EmptyState size="sm" title="This list could not be loaded" />
        ) : list.pages.length === 0 ? (
          <EmptyState size="sm" {...EMPTY[tab]} />
        ) : (
          <div className="flex flex-col">
            {list.pages.map((page) => {
              const when = formatRelative(page.updatedAt);
              return (
                <DocListRow
                  key={page.id}
                  href={docsPaths.page(page.id)}
                  title={page.title}
                  icon={page.icon}
                  place={spaces.get(page.spaceId)?.name ?? page.spaceKey}
                  person={person(page.ownerId)}
                  when={tab === 'drafts' ? `${PAGE_STATUS_LABELS[page.status]} · ${when}` : when}
                />
              );
            })}
          </div>
        )}
        {more?.hasNextPage && (
          <div className="flex justify-center border-t border-line-2 py-1.5">
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
      </TabPanel>
    </Card>
  );
}

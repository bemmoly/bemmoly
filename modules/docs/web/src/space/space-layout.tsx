import type { Space } from '@bemmoly/module-docs/shared';
import { Button, EmptyState, type PageTreeItem } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { createContext, useContext, type ReactNode } from 'react';
import { useCreatePage } from '../create/use-create-page.ts';
import { useSpace } from '../hooks/queries.ts';
import { useDocsRealtime } from '../hooks/use-docs-realtime.ts';
import { DocsLayout } from '../shared/docs-layout.tsx';
import { docsPaths, keepLinksInApp, navigateTo } from '../shared/navigation.ts';
import { PageSkeleton, SpaceSkeleton } from '../skeletons/docs-skeletons.tsx';

interface SpaceActions {
  space: Space;
  /** Creates "Untitled" at the root (null) or inside a page, and opens it. */
  createPage: (parent: Pick<PageTreeItem, 'id' | 'title'> | null) => void;
}

const SpaceContext = createContext<SpaceActions | null>(null);

/** The space a screen inside SpaceLayout shows, and its create action. */
export function useSpaceActions(): SpaceActions {
  const actions = useContext(SpaceContext);
  if (!actions) throw new Error('useSpaceActions is used inside SpaceLayout');
  return actions;
}

export interface SpaceLayoutProps {
  /** The space key ("ENG") or id. */
  spaceRef: string;
  /** The layout its screen draws in, so loading and errors hold the same shape. */
  layout: 'full' | 'contained';
  /** The screen: the overview, the trash or a page. Each draws its own DocsLayout. */
  children: ReactNode;
}

/**
 * Every screen inside a space: loads the space, follows its realtime events and hands its
 * screens the space and create in place. Its page tree is in the app sidebar; a space that
 * did not load says so in the frame, with Retry, and the sidebar stays.
 */
export function SpaceLayout({ spaceRef, layout, children }: SpaceLayoutProps) {
  const space = useSpace(spaceRef);
  useDocsRealtime(space.data ? [space.data.id] : []);
  const newPage = useCreatePage();

  if (space.isPending) {
    return (
      <DocsLayout layout={layout}>
        {layout === 'full' ? <PageSkeleton /> : <SpaceSkeleton />}
      </DocsLayout>
    );
  }
  if (space.isError) {
    return (
      <DocsLayout layout={layout}>
        <EmptyState
          headingLevel={1}
          className="flex-1 justify-center py-16"
          icon={<Icon name="doc" />}
          title={`${spaceRef} could not be opened`}
          description="It may have been deleted, or you may not be a member of it. If the server was busy, try again."
          action={
            <span className="flex gap-2">
              <Button
                variant="primary"
                icon={<Icon name="refresh" size={14} />}
                onClick={() => void space.refetch()}
              >
                Try again
              </Button>
              <Button variant="ghost" onClick={() => navigateTo(docsPaths.home())}>
                Back to Docs
              </Button>
            </span>
          }
        />
      </DocsLayout>
    );
  }

  const actions: SpaceActions = {
    space: space.data,
    createPage: (parent) =>
      newPage.create({
        spaceId: space.data.id,
        parentId: parent?.id ?? null,
        placeName: parent ? parent.title || 'Untitled' : space.data.name,
      }),
  };
  return (
    <SpaceContext.Provider value={actions}>
      <div
        className="contents"
        onClick={keepLinksInApp}
        data-search-place={space.data.key}
        data-search-place-label={space.data.name}
        data-search-place-kind="docs.page"
      >
        {children}
      </div>
    </SpaceContext.Provider>
  );
}

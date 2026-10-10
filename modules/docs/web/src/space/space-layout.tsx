import type { Space } from '@bemmoly/module-docs/shared';
import { Button, Drawer, EmptyState, type PageTreeItem } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CreateSpaceDialog } from '../create/create-space-dialog.tsx';
import { useCreatePage } from '../create/use-create-page.ts';
import { useSpace } from '../hooks/queries.ts';
import { useDocsRealtime } from '../hooks/use-docs-realtime.ts';
import { docsPaths, keepLinksInApp, navigateTo } from '../shared/navigation.ts';
import { useSession } from '../shared/people.ts';
import { SpaceSkeleton } from '../skeletons/docs-skeletons.tsx';
import { SpaceSidebar } from './space-sidebar.tsx';
import { useTreeOpen } from './tree-store.ts';

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
  /** The page open in the main column; its row is highlighted and its ancestors open. */
  activePageId?: string | null;
  /** The active page's ancestors, root first: opened in the tree so the page shows. */
  activeTrail?: readonly string[];
  inTrash?: boolean;
  /** The main column. It fills the rest of the width and scrolls on its own. */
  children: ReactNode;
}

/**
 * Every screen inside a space: the 260px sidebar with the page tree beside a main column.
 * The space overview, the trash and the page screen use it; the doc editor screen puts its
 * own header and body in `children`. Below 768px the sidebar folds into a drawer opened
 * from a Pages button. It also owns the create dialogs, so the tree, the footer and the
 * main column all open the same picker.
 */
export function SpaceLayout({
  spaceRef,
  activePageId = null,
  activeTrail,
  inTrash = false,
  children,
}: SpaceLayoutProps) {
  const space = useSpace(spaceRef);
  const reveal = useTreeOpen((state) => state.reveal);
  const spaceKey = space.data?.key;
  const trail = activeTrail?.join('/') ?? '';
  useEffect(() => {
    if (spaceKey && trail) reveal(spaceKey, trail.split('/'));
  }, [spaceKey, trail, reveal]);
  useDocsRealtime(space.data ? [space.data.id] : []);
  const newPage = useCreatePage();
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const { can } = useSession();

  if (space.isPending) return <SpaceSkeleton />;
  if (space.isError) {
    return (
      <EmptyState
        headingLevel={1}
        className="flex-1 justify-center"
        icon={<Icon name="doc" />}
        title={`${spaceRef} could not be opened`}
        description="It may have been deleted, or you may not be a member of it."
        action={
          <Button variant="secondary" onClick={() => navigateTo(docsPaths.home())}>
            Back to Docs
          </Button>
        }
      />
    );
  }

  const actions: SpaceActions = {
    space: space.data,
    createPage: (parent) => {
      setDrawer(false);
      newPage.create({
        spaceId: space.data.id,
        parentId: parent?.id ?? null,
        placeName: parent ? parent.title || 'Untitled' : space.data.name,
      });
    },
  };
  const sidebar = (
    <SpaceSidebar
      space={space.data}
      activePageId={activePageId}
      inTrash={inTrash}
      onCreatePage={actions.createPage}
      onCreateSpace={can('docs.space.create') ? () => setCreatingSpace(true) : undefined}
    />
  );

  return (
    <SpaceContext.Provider value={actions}>
      <div
        className="flex min-h-0 flex-1"
        onClick={keepLinksInApp}
        data-search-place={space.data.key}
        data-search-place-label={space.data.name}
        data-search-place-kind="docs.page"
      >
        <aside className="hidden w-65 shrink-0 flex-col border-r border-line bg-card md:flex">
          {sidebar}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center border-b border-line bg-card px-4 py-2 md:hidden">
            <Button
              size="sm"
              variant="secondary"
              icon={<Icon name="lines" size={14} />}
              onClick={() => setDrawer(true)}
            >
              {space.data.name} pages
            </Button>
          </div>
          {children}
        </div>
      </div>
      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        label={`${space.data.name} pages`}
        variant="overlay"
      >
        <div className="flex h-full flex-col" onClick={keepLinksInApp}>
          {sidebar}
        </div>
      </Drawer>
      <CreateSpaceDialog
        open={creatingSpace}
        onClose={() => setCreatingSpace(false)}
        onCreated={(created) => {
          setCreatingSpace(false);
          navigateTo(docsPaths.space(created.key));
        }}
      />
    </SpaceContext.Provider>
  );
}

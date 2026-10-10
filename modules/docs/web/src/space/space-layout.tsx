import type { Space } from '@bemmoly/module-docs/shared';
import { Button, Drawer, EmptyState, type PageTreeItem } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CreatePageDialog } from '../create/create-page-dialog.tsx';
import { CreateSpaceDialog } from '../create/create-space-dialog.tsx';
import { useSpace } from '../hooks/queries.ts';
import { useDocsRealtime } from '../hooks/use-docs-realtime.ts';
import { docsPaths, keepLinksInApp, navigateTo } from '../shared/navigation.ts';
import { useSession } from '../shared/people.ts';
import { SpaceSkeleton } from '../skeletons/docs-skeletons.tsx';
import { SpaceSidebar } from './space-sidebar.tsx';
import { useTreeOpen } from './tree-store.ts';

interface SpaceActions {
  space: Space;
  /** Opens the new-page picker at the root (null) or inside a page. */
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
  const [creating, setCreating] = useState<{ id: string; title: string } | null | false>(false);
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
    createPage: (parent) => setCreating(parent ? { id: parent.id, title: parent.title } : null),
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
      <div className="flex min-h-0 flex-1" onClick={keepLinksInApp}>
        <aside className="hidden w-65 shrink-0 flex-col border-r border-br bg-sf md:flex">
          {sidebar}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center border-b border-br bg-sf px-4 py-2 md:hidden">
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
      <CreatePageDialog
        open={creating !== false}
        spaceId={space.data.id}
        parentId={creating ? creating.id : null}
        parentTitle={creating ? creating.title : null}
        onClose={() => setCreating(false)}
        onCreated={(page) => {
          setCreating(false);
          setDrawer(false);
          navigateTo(docsPaths.page(page.id));
        }}
      />
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

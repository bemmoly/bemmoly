import type { Space } from '@bemmoly/module-docs/shared';
import {
  Button,
  EmptyState,
  MenuItem,
  MenuSeparator,
  PageTree,
  Skeleton,
  type PageTreeItem,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { useStarredIds } from '../hooks/home-queries.ts';
import { docsPaths, navigateTo } from '../shared/navigation.ts';
import { useTreeOpen } from './tree-store.ts';
import { useSpaceTree } from './use-space-tree.ts';
import {
  useMoveInTree,
  useRenameInTree,
  useStarFromTree,
  useTrashFromTree,
} from './use-tree-actions.ts';

export interface SidebarTreeProps {
  space: Space;
  activePageId: string | null;
  /** The + on a row, and "Add a page inside" in its menu. */
  onAddChild: (item: PageTreeItem) => void;
  onCreate: () => void;
}

function TreeSkeleton() {
  return (
    <div role="status" aria-label="Loading pages" className="flex flex-col gap-px">
      {[62, 48, 70, 55, 40, 66].map((width, index) => (
        <span key={index} className="flex h-7.5 items-center gap-1.75 pl-2.5">
          <Skeleton width={9} height={9} shape="block" />
          <Skeleton width={`${width}%`} height={10} />
        </span>
      ))}
    </div>
  );
}

/**
 * The space's pages in the sidebar: the shared tree, wired to the tree and move APIs.
 * Moves, renames and trashing paint at once and roll back if refused; opening a page
 * navigates in place, a modifier click opens it in a new tab.
 */
export function SidebarTree({ space, activePageId, onAddChild, onCreate }: SidebarTreeProps) {
  const tree = useSpaceTree(space.key);
  const setOpen = useTreeOpen((state) => state.set);
  const [renaming, setRenaming] = useState<string | null>(null);
  const move = useMoveInTree(space.key);
  const rename = useRenameInTree(space.key);
  const star = useStarFromTree();
  const starred = useStarredIds();
  const trash = useTrashFromTree(space.key, (pageId) => {
    if (pageId === activePageId) navigateTo(docsPaths.space(space.key));
  });

  if (tree.isPending) return <TreeSkeleton />;
  if (tree.isError) {
    return (
      <EmptyState
        size="sm"
        title="Pages could not be loaded"
        description={tree.error?.message}
        action={
          <Button size="sm" variant="secondary" onClick={tree.refetch}>
            Try again
          </Button>
        }
      />
    );
  }
  if (tree.items.length === 0) {
    return (
      <EmptyState
        size="sm"
        icon={<Icon name="doc" />}
        title="No pages yet"
        description="The first page you write here starts the tree."
        action={
          <Button size="sm" onClick={onCreate}>
            New page
          </Button>
        }
      />
    );
  }

  return (
    <PageTree
      label={`Pages in ${space.name}`}
      items={tree.items}
      activeId={activePageId}
      hrefOf={(item) => docsPaths.page(item.id)}
      onOpen={(item, event) => {
        const href = docsPaths.page(item.id);
        if (event.metaKey || event.ctrlKey || event.shiftKey) window.open(href, '_blank');
        else navigateTo(href);
      }}
      onToggle={(item, open) => setOpen(space.key, item.id, open)}
      onMove={(change) => move.mutate(change)}
      onAddChild={onAddChild}
      renamingId={renaming}
      onRenameStart={(item) => setRenaming(item.id)}
      onRename={(item, title) => {
        setRenaming(null);
        rename.mutate({ id: item.id, title });
      }}
      onRenameCancel={() => setRenaming(null)}
      menu={(item) => {
        const isStarred = starred.has(item.id);
        return (
          <>
            <MenuItem onSelect={() => onAddChild(item)} icon={<Icon name="plus" />}>
              Add a page inside
            </MenuItem>
            <MenuItem onSelect={() => setRenaming(item.id)} icon={<Icon name="edit" />} hint="F2">
              Rename
            </MenuItem>
            <MenuItem
              onSelect={() => star.mutate({ id: item.id, starred: !isStarred })}
              icon={<Icon name="star" />}
            >
              {isStarred ? 'Unstar' : 'Star'}
            </MenuItem>
            <MenuItem
              onSelect={() =>
                void navigator.clipboard?.writeText(
                  new URL(docsPaths.page(item.id), window.location.origin).href,
                )
              }
              icon={<Icon name="external" />}
            >
              Copy link
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              tone="danger"
              onSelect={() => trash.trash({ id: item.id, title: item.title })}
              icon={<Icon name="trash" />}
            >
              Move to trash
            </MenuItem>
          </>
        );
      }}
    />
  );
}

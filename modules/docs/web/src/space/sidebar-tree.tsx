import { useFrame } from '@bemmoly/core-web';
import type { Space } from '@bemmoly/module-docs/shared';
import {
  Button,
  Kbd,
  MenuItem,
  MenuSeparator,
  PageTree,
  Skeleton,
  useToast,
  type PageTreeItem,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useEffect, useState } from 'react';
import { useDuplicatePage } from '../create/use-duplicate-page.ts';
import { useStarredIds } from '../hooks/home-queries.ts';
import { MoveDialog } from '../page/header/move-dialog.tsx';
import { docsPaths } from '../shared/navigation.ts';
import { useTreeOpen } from './tree-store.ts';
import { useSpaceTree } from './use-space-tree.ts';
import { useCreatePage } from '../create/use-create-page.ts';
import {
  useMoveInTree,
  useRenameInTree,
  useStarFromTree,
  useTrashFromTree,
} from './use-tree-actions.ts';

export interface SidebarTreeProps {
  space: Space;
  activePageId: string | null;
  /** Where depth 0 starts: one level in under the space's row, flush in focus mode. */
  indentStart: number;
}

function TreeSkeleton({ indent }: { indent: number }) {
  return (
    <div role="status" aria-label="Loading pages" className="flex flex-col gap-px">
      {[62, 48, 70, 55].map((width) => (
        <span key={width} className="flex h-7 items-center gap-1.5" style={{ paddingLeft: indent }}>
          <span className="size-4.5 shrink-0" />
          <Skeleton width={15} height={15} className="rounded-chip" />
          <Skeleton width={`${width}%`} height={10} />
        </span>
      ))}
    </div>
  );
}

/** One quiet line for what the tree cannot show: loading failed, or nothing written yet. */
const QUIET =
  'flex h-7 w-full items-center gap-1.5 rounded-control border-0 bg-transparent pr-1 text-left font-sans text-13 text-tx-3';

/**
 * The current space's pages under its sidebar row: the shared tree, wired to the tree and move
 * APIs. Moves, renames and trashing paint at once and roll back if refused; + makes a page
 * inside a row and opens it; opening a page navigates in place, a modifier click opens a tab.
 * The open page's row is scrolled into view, so the tree follows a page opened from a link.
 */
export function SidebarTree({ space, activePageId, indentStart }: SidebarTreeProps) {
  const tree = useSpaceTree(space.key);
  const { navigate } = useFrame();
  const { show } = useToast();
  const setOpen = useTreeOpen((state) => state.set);
  const [renaming, setRenaming] = useState<string | null>(null);
  const move = useMoveInTree(space.key);
  const rename = useRenameInTree(space.key);
  const star = useStarFromTree();
  const starred = useStarredIds();
  const add = useCreatePage();
  const copy = useDuplicatePage();
  const [moving, setMoving] = useState<PageTreeItem | null>(null);
  const trash = useTrashFromTree(space.key, (pageId) => {
    if (pageId === activePageId) navigate(docsPaths.space(space.key));
  });
  const addInside = (item: PageTreeItem) =>
    add.create({ spaceId: space.id, parentId: item.id, placeName: item.title || 'Untitled' });
  const shown = tree.items.some((item) => item.id === activePageId);

  useEffect(() => {
    if (!activePageId || !shown) return;
    document.getElementById(`tree-${activePageId}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [activePageId, shown]);

  if (tree.isPending) return <TreeSkeleton indent={indentStart} />;
  if (tree.isError) {
    return (
      <p className={`m-0 ${QUIET}`} style={{ paddingLeft: indentStart }}>
        <span className="min-w-0 flex-1 truncate">Pages did not load.</span>
        <Button size="sm" variant="ghost" onClick={tree.refetch}>
          Retry
        </Button>
      </p>
    );
  }
  if (tree.items.length === 0) {
    return (
      <button
        type="button"
        onClick={() => add.create({ spaceId: space.id, parentId: null, placeName: space.name })}
        style={{ paddingLeft: indentStart }}
        className={`${QUIET} cursor-pointer hover:bg-hover hover:text-tx focus-ring-inset`}
      >
        <span className="size-4.5 shrink-0" />
        <Icon name="plus" size={14} />
        <span className="min-w-0 flex-1">New page</span>
        <Kbd keys="N" />
      </button>
    );
  }

  return (
    <>
      <PageTree
        label={`Pages in ${space.name}`}
        items={tree.items}
        activeId={activePageId}
        indentStart={indentStart}
        hrefOf={(item) => docsPaths.page(item.id)}
        onOpen={(item, event) => {
          const href = docsPaths.page(item.id);
          if (event.metaKey || event.ctrlKey || event.shiftKey) window.open(href, '_blank');
          else navigate(href);
        }}
        onToggle={(item, open) => setOpen(space.key, item.id, open)}
        onMove={(change) => move.mutate(change)}
        onAddChild={addInside}
        renamingId={renaming}
        onRenameStart={(item) => setRenaming(item.id)}
        onRename={(item, title) => {
          setRenaming(null);
          rename.mutate({ id: item.id, title });
        }}
        onRenameCancel={() => setRenaming(null)}
        menu={(item) => {
          const isStarred = starred.has(item.id);
          const href = docsPaths.page(item.id);
          return (
            <>
              <MenuItem onSelect={() => addInside(item)} icon={<Icon name="plus" />}>
                Add a page inside
              </MenuItem>
              <MenuItem onSelect={() => setRenaming(item.id)} icon={<Icon name="edit" />} hint="F2">
                Rename
              </MenuItem>
              <MenuItem onSelect={() => copy.duplicate(item.id)} icon={<Icon name="copy" />}>
                Duplicate
              </MenuItem>
              <MenuItem onSelect={() => setMoving(item)} icon={<Icon name="arrow" />}>
                Move to…
              </MenuItem>
              <MenuItem
                onSelect={() => star.mutate({ id: item.id, starred: !isStarred })}
                icon={<Icon name="star" />}
              >
                {isStarred ? 'Unstar' : 'Star'}
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  void navigator.clipboard?.writeText(new URL(href, window.location.origin).href);
                  show({ tone: 'ok', title: 'Link copied' });
                }}
                icon={<Icon name="link" />}
              >
                Copy link
              </MenuItem>
              <MenuItem
                onSelect={() => window.open(href, '_blank')}
                icon={<Icon name="external" />}
              >
                Open in new tab
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
      <MoveDialog
        page={{ id: moving?.id ?? '', spaceId: space.id, title: moving?.title ?? '' }}
        open={moving !== null}
        onClose={() => setMoving(null)}
      />
    </>
  );
}

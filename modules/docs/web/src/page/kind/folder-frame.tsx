import type { PageDetail } from '@bemmoly/module-docs/shared';
import { Button, Card, DocListRowSkeleton, EmptyState } from '@bemmoly/ui';
import { Icon, PageIcon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useCreateFolder } from '../../create/use-create-folder.ts';
import { useCreatePage } from '../../create/use-create-page.ts';
import { useNewPageKey } from '../../create/use-new-page-key.ts';
import { moveInList, PageRow } from '../../home/page-row.tsx';
import { iconOfPage } from '../../shared/page-kind.ts';
import { usePeople } from '../../shared/people.ts';
import { levelQuery } from '../../space/use-space-tree.ts';
import { usePageScreen } from '../screen-context.ts';
import { KindFrame } from './kind-frame.tsx';

const count = (n: number) => (n === 1 ? '1 item' : `${n} items`);

/** The folder's children, in the tree's order, with New page and New folder to add more. */
function FolderContents() {
  const { page, readOnly } = usePageScreen();
  const children = useQuery(levelQuery(page.spaceKey, page.id));
  const { person } = usePeople();
  const addPage = useCreatePage();
  const addFolder = useCreateFolder();
  const place = { spaceId: page.spaceId, parentId: page.id, placeName: page.title || 'Untitled' };
  const canAdd = readOnly === null;
  useNewPageKey(canAdd ? () => addPage.create(place) : null);
  const items = children.data ?? [];

  const actions = canAdd && (
    <span className="flex gap-2">
      <Button
        variant="primary"
        icon={<Icon name="plus" size={14} />}
        disabled={addPage.isPending}
        onClick={() => addPage.create(place)}
      >
        New page
      </Button>
      <Button
        variant="secondary"
        icon={<Icon name="folder" size={14} />}
        disabled={addFolder.isPending}
        onClick={() => addFolder.create(place)}
      >
        New folder
      </Button>
    </span>
  );

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto flex max-w-260 flex-col gap-5 px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <PageIcon value={iconOfPage(page)} size={20} className="text-tx-3" />
          <h1 className="m-0 min-w-0 flex-1 truncate text-20 font-semibold text-tx">
            {page.title || 'Untitled'}
          </h1>
          {!children.isPending && items.length > 0 && (
            <span className="text-12 text-tx-3 tabular-nums">{count(items.length)}</span>
          )}
          {items.length > 0 && actions}
        </div>
        {children.isPending ? (
          <Card className="overflow-hidden">
            <DocListRowSkeleton rows={4} />
          </Card>
        ) : children.isError ? (
          <EmptyState
            icon={<Icon name="alert" />}
            title="This folder did not load"
            description="Nothing in it was lost. Try again in a moment."
            action={
              <Button variant="secondary" onClick={() => void children.refetch()}>
                Try again
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Icon name="folder" />}
            title="This folder is empty"
            description={
              canAdd
                ? 'Add a page or a folder here, or drag pages onto it in the sidebar.'
                : 'Nothing has been put in it yet.'
            }
            {...(actions ? { action: actions } : {})}
          />
        ) : (
          <Card className="overflow-hidden" onKeyDown={moveInList}>
            {items.map((child) => {
              const owner = person(child.ownerId);
              return (
                <PageRow
                  key={child.id}
                  page={{ ...child, icon: iconOfPage(child) }}
                  place={child.hasChildren ? 'Has pages inside' : null}
                  person={owner}
                  when={child.updatedAt}
                />
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}

/**
 * A folder (ADR 0049): no body, just what is in it. The header keeps the trail, star, Share
 * and ···; the list reads in the tree's order, and N adds a page inside.
 */
export function FolderFrame({ page }: { page: PageDetail }) {
  return (
    <KindFrame page={page}>
      <FolderContents />
    </KindFrame>
  );
}

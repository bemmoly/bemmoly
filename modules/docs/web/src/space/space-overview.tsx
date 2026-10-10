import { HeaderActions } from '@bemmoly/core-web';
import { AvatarStack, Button, Card, DocListRowSkeleton, Kbd, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { CreatePageDialog } from '../create/create-page-dialog.tsx';
import { useNewPageKey } from '../create/use-new-page-key.ts';
import { SpaceMark } from '../home/page-row.tsx';
import { DocsLayout } from '../shared/docs-layout.tsx';
import { docsPaths, navigateTo } from '../shared/navigation.ts';
import { usePeople, useSession } from '../shared/people.ts';
import { ImportDialog } from '../transfer/import-dialog.tsx';
import { EmptySpace } from './overview/empty-space.tsx';
import { InReview, RecentlyUpdated, TopPages } from './overview/overview-parts.tsx';
import { StartHere } from './overview/start-here.tsx';
import { useSpaceMembers, useSpaceRecent } from './overview/use-overview.ts';
import { pageCountLabel } from './page-count.ts';
import { useSpaceActions } from './space-layout.tsx';
import { useSpaceTree } from './use-space-tree.ts';

/**
 * A space's overview: who and what it is, Start here (its home page), what waits in review,
 * its top-level pages and who changed what. An empty space asks for its first page instead.
 * N makes a page at the top of the space, in place.
 */
export function SpaceOverview() {
  const { space, createPage } = useSpaceActions();
  const tree = useSpaceTree(space.key);
  const recent = useSpaceRecent(space.id);
  const members = useSpaceMembers(space.key);
  const { person } = usePeople();
  const { can, user } = useSession();
  const [dialog, setDialog] = useState<'template' | 'import' | null>(null);
  const roots = tree.items.filter((item) => item.depth === 0);
  const canWrite = can('docs.page.edit');
  const canChange = members.data?.canManage ?? false;
  const empty = !tree.isPending && roots.length === 0;
  useNewPageKey(canWrite && !dialog ? () => createPage(null) : null);

  return (
    <DocsLayout layout="contained">
      {canWrite && !empty && (
        <HeaderActions>
          <Button
            variant="ghost"
            className="max-sm:hidden!"
            icon={<Icon name="upload" size={14} />}
            onClick={() => setDialog('import')}
          >
            Import
          </Button>
          <Button
            variant="primary"
            icon={<Icon name="plus" size={15} />}
            iconEnd={<Kbd keys="N" className="max-sm:hidden!" />}
            onClick={() => createPage(null)}
          >
            New page
          </Button>
        </HeaderActions>
      )}
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-start gap-3.5">
          <SpaceMark space={space} size={44} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h1 className="m-0 truncate text-24 font-semibold tracking-display text-tx">
              {space.name}
            </h1>
            <p className="m-0 text-13 text-tx-3">
              {space.description || pageCountLabel(space.pageCount)}
              {space.description && ` · ${pageCountLabel(space.pageCount)}`}
            </p>
          </div>
          {members.data && members.data.items.length > 0 && (
            <AvatarStack
              className="mt-1.5"
              size={24}
              max={4}
              label={`${members.data.items.length} members`}
              people={members.data.items.map((member) => ({
                id: member.userId,
                name: member.name,
              }))}
            />
          )}
        </header>

        {tree.isPending ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Skeleton height={150} className="rounded-card" />
            <Card className="overflow-hidden">
              <DocListRowSkeleton rows={3} />
            </Card>
          </div>
        ) : empty ? (
          <EmptySpace
            spaceName={space.name}
            canWrite={canWrite}
            onBlank={() => createPage(null)}
            onTemplate={() => setDialog('template')}
            onImport={() => setDialog('import')}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <StartHere space={space} roots={roots} canChange={canChange} />
              <InReview pages={recent.data ?? []} pending={recent.isPending} person={person} />
            </div>
            <section aria-labelledby="space-pages" className="flex flex-col gap-2.5">
              <h2 id="space-pages" className="m-0 text-13 font-semibold text-tx-2">
                Pages
              </h2>
              <TopPages roots={roots} summaries={tree.summaries} person={person} />
            </section>
            <section aria-labelledby="space-recent" className="flex flex-col gap-2.5">
              <h2 id="space-recent" className="m-0 text-13 font-semibold text-tx-2">
                Recently updated
              </h2>
              <RecentlyUpdated
                pages={recent.data ?? []}
                pending={recent.isPending}
                meId={user?.id ?? null}
              />
            </section>
          </>
        )}
      </div>
      <CreatePageDialog
        open={dialog === 'template'}
        spaceId={space.id}
        parentId={null}
        templateId={null}
        onClose={() => setDialog(null)}
        onCreated={(page) => navigateTo(docsPaths.page(page.id))}
      />
      <ImportDialog open={dialog === 'import'} onClose={() => setDialog(null)} space={space} />
    </DocsLayout>
  );
}

import { HeaderActions } from '@bemmoly/core-web';
import type { Space } from '@bemmoly/module-docs/shared';
import { Button, EmptyState, Kbd } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useMemo, useState } from 'react';
import { CreatePageDialog } from '../create/create-page-dialog.tsx';
import { CreateSpaceDialog } from '../create/create-space-dialog.tsx';
import { useCreatePage } from '../create/use-create-page.ts';
import { useNewPageKey } from '../create/use-new-page-key.ts';
import { useAttention } from '../hooks/home-queries.ts';
import { useRecentPages, useSpaces } from '../hooks/queries.ts';
import { useDocsRealtime } from '../hooks/use-docs-realtime.ts';
import type { DocsScreenProps } from '../routes.tsx';
import { DocsLayout } from '../shared/docs-layout.tsx';
import { docsPaths, keepLinksInApp, navigateTo } from '../shared/navigation.ts';
import { usePeople, useSession } from '../shared/people.ts';
import { ImportDialog } from '../transfer/import-dialog.tsx';
import { FirstRun } from './first-run.tsx';
import { HomeLoading } from './home-loading.tsx';
import { JumpBackIn } from './jump-back-in.tsx';
import { PageLenses, type Lens } from './page-lenses.tsx';
import { NeedsYou, SpacesList } from './side-panels.tsx';

type Dialog = { kind: 'page' } | { kind: 'space' } | { kind: 'import' } | null;

/** /docs/create and /docs/spaces/new are the Create menu's entries: the home with a dialog. */
function dialogFor({ segment, rest }: DocsScreenProps, screen: string): Dialog {
  if (screen === 'create') return { kind: 'page' };
  if (screen === 'spaces' && (segment ?? rest[0]) === 'new') return { kind: 'space' };
  return null;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The Docs home at /docs: Jump back in, then one list with four lenses beside Needs you and
 * the spaces. New page (N) makes a page in place in the space the person last wrote in.
 * Before any space exists it is the first-run guide instead.
 */
export default function DocsHomeScreen(props: DocsScreenProps) {
  const spaces = useSpaces();
  const recent = useRecentPages();
  const attention = useAttention();
  const { person } = usePeople();
  const { can, user } = useSession();
  const userId = user?.id ?? null;
  const newPage = useCreatePage();
  const canCreateSpace = can('docs.space.create');
  const routed = dialogFor(props, props.screen);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [lens, setLens] = useState<Lens>('recent');
  const open = dialog ?? routed;
  const list = useMemo(() => spaces.data ?? [], [spaces.data]);
  useDocsRealtime(list.map((space) => space.id));
  const byId = useMemo(() => new Map(list.map((space) => [space.id, space])), [list]);
  const recentPages = recent.data?.pages.flatMap((page) => page.items) ?? [];
  // The space the person last wrote in, else the first one they can see.
  const home: Space | undefined =
    byId.get(recentPages.find((page) => page.lastEditor?.id === userId)?.spaceId ?? '') ?? list[0];
  const createHere = home
    ? () => newPage.create({ spaceId: home.id, parentId: null, placeName: home.name })
    : null;
  useNewPageKey(open ? null : createHere);

  const close = () => {
    setDialog(null);
    if (routed) navigateTo(docsPaths.home());
  };

  if (spaces.isPending) {
    return (
      <DocsLayout layout="contained">
        <HomeLoading />
      </DocsLayout>
    );
  }
  const pages = list.reduce((sum, space) => sum + space.pageCount, 0);
  const reviews = (attention.data?.items ?? []).filter((item) => item.kind === 'review').length;
  const meta = [
    plural(list.length, 'space', 'spaces'),
    plural(pages, 'page', 'pages'),
    reviews > 0 && `${plural(reviews, 'page', 'pages')} waiting for your review`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <DocsLayout layout="contained">
      {list.length > 0 && (
        <HeaderActions>
          <Button
            variant="ghost"
            icon={<Icon name="upload" size={14} />}
            onClick={() => setDialog({ kind: 'import' })}
          >
            Import
          </Button>
          <Button
            variant="secondary"
            icon={<Icon name="layers" size={14} />}
            onClick={() => setDialog({ kind: 'page' })}
          >
            Templates
          </Button>
          <Button
            variant="primary"
            icon={<Icon name="plus" size={15} />}
            iconEnd={<Kbd keys="N" />}
            loading={newPage.isPending}
            onClick={() => createHere?.()}
          >
            New page
          </Button>
        </HeaderActions>
      )}
      <div className="flex flex-col gap-6" onClick={keepLinksInApp}>
        <header className="flex flex-col gap-0.5">
          <h1 className="m-0 text-24 font-semibold tracking-display text-tx">Docs</h1>
          {list.length > 0 && <p className="m-0 text-13h text-tx4">{meta}</p>}
        </header>

        {spaces.isError ? (
          <EmptyState
            icon={<Icon name="warning" />}
            title="Docs didn’t load"
            description="Nothing was lost. Check your connection and try again."
            action={
              <Button variant="secondary" onClick={() => void spaces.refetch()}>
                Try again
              </Button>
            }
          />
        ) : list.length === 0 ? (
          <FirstRun
            onCreateSpace={canCreateSpace ? () => setDialog({ kind: 'space' }) : undefined}
          />
        ) : (
          <>
            <JumpBackIn
              pages={recentPages}
              pending={recent.isPending}
              spaces={byId}
              meId={userId}
            />
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <PageLenses lens={lens} onLens={setLens} spaces={byId} person={person} />
              <div className="flex flex-col gap-5">
                <NeedsYou person={person} />
                <SpacesList
                  spaces={list}
                  onCreateSpace={canCreateSpace ? () => setDialog({ kind: 'space' }) : undefined}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <CreatePageDialog
        open={open?.kind === 'page'}
        spaceId={home?.id ?? null}
        parentId={null}
        templateId={null}
        onClose={close}
        onCreated={(page) => navigateTo(docsPaths.page(page.id))}
      />
      <CreateSpaceDialog
        open={open?.kind === 'space'}
        onClose={close}
        onCreated={(space) => navigateTo(docsPaths.space(space.key))}
      />
      {home && <ImportDialog open={open?.kind === 'import'} onClose={close} space={home} />}
    </DocsLayout>
  );
}

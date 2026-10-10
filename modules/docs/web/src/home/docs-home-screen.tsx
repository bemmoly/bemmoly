import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useMemo, useState } from 'react';
import { CreatePageDialog } from '../create/create-page-dialog.tsx';
import { CreateSpaceDialog } from '../create/create-space-dialog.tsx';
import { useRecentPages, useSpaces, useTemplates } from '../hooks/queries.ts';
import { useDocsRealtime } from '../hooks/use-docs-realtime.ts';
import type { DocsScreenProps } from '../routes.tsx';
import { docsPaths, keepLinksInApp, navigateTo } from '../shared/navigation.ts';
import { usePeople, useSession } from '../shared/people.ts';
import { HomeSkeleton } from '../skeletons/docs-skeletons.tsx';
import { pageCountLabel } from '../space/space-sidebar.tsx';
import { FirstRun } from './first-run.tsx';
import { PageLists } from './page-lists.tsx';
import { AttentionPanel, TemplatesPanel } from './side-panels.tsx';
import { SpaceGrid } from './space-grid.tsx';

type Dialog = { kind: 'page'; templateId: string | null } | { kind: 'space' } | null;

/** /docs/create and /docs/spaces/new are the Create menu's entries: the home with a dialog. */
function dialogFor({ segment, rest }: DocsScreenProps, screen: string): Dialog {
  if (screen === 'create') return { kind: 'page', templateId: null };
  if (screen === 'spaces' && (segment ?? rest[0]) === 'new') return { kind: 'space' };
  return null;
}

/**
 * The Docs home at /docs, after the Docs mock: the header with the totals, the space cards,
 * then Recent / Starred / Drafts beside "Needs attention" and Templates. Before any space
 * exists it is the first-run guide instead.
 */
export default function DocsHomeScreen(props: DocsScreenProps) {
  const spaces = useSpaces();
  const recent = useRecentPages();
  const templates = useTemplates();
  const { person } = usePeople();
  const { workspaceName, can } = useSession();
  const canCreateSpace = can('docs.space.create');
  const routed = dialogFor(props, props.screen);
  const [dialog, setDialog] = useState<Dialog>(null);
  const open = dialog ?? routed;
  const spaceIds = (spaces.data ?? []).map((space) => space.id);
  useDocsRealtime(spaceIds);
  const byId = useMemo(
    () => new Map((spaces.data ?? []).map((space) => [space.id, space])),
    [spaces.data],
  );

  const close = () => {
    setDialog(null);
    if (routed) navigateTo(docsPaths.home());
  };

  if (spaces.isPending) return <HomeSkeleton />;
  const list = spaces.data ?? [];
  const pages = list.reduce((sum, space) => sum + space.pageCount, 0);
  const meta = [
    `${list.length} ${list.length === 1 ? 'space' : 'spaces'}`,
    pageCountLabel(pages),
    workspaceName,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="min-h-0 flex-1 overflow-auto" onClick={keepLinksInApp}>
      <div className="mx-auto flex max-w-300 flex-col gap-7 px-4 pt-8 pb-15 sm:px-10">
        <header className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-24 font-semibold tracking-display text-tx">Docs</h1>
            {spaces.isSuccess && <p className="m-0 text-13h text-tx4">{meta}</p>}
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setDialog({ kind: 'page', templateId: null })}
            >
              Templates
            </Button>
            {canCreateSpace && (
              <Button variant="secondary" onClick={() => setDialog({ kind: 'space' })}>
                Create space
              </Button>
            )}
            {list.length > 0 && (
              <Button
                variant="primary"
                onClick={() => setDialog({ kind: 'page', templateId: null })}
              >
                New page
              </Button>
            )}
          </div>
        </header>

        {spaces.isError ? (
          <EmptyState
            icon={<Icon name="alert" />}
            title="Docs could not be loaded"
            description={spaces.error.message}
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
            <SpaceGrid spaces={list} recent={recent.data?.pages[0]?.items ?? []} person={person} />
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <PageLists spaces={byId} person={person} />
              <div className="flex flex-col gap-5">
                <AttentionPanel person={person} />
                <TemplatesPanel
                  templates={templates.data ?? []}
                  onPick={(templateId) => setDialog({ kind: 'page', templateId })}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <CreatePageDialog
        open={open?.kind === 'page'}
        spaceId={null}
        parentId={null}
        templateId={open?.kind === 'page' ? open.templateId : null}
        onClose={close}
        onCreated={(page) => navigateTo(docsPaths.page(page.id))}
      />
      <CreateSpaceDialog
        open={open?.kind === 'space'}
        onClose={close}
        onCreated={(space) => navigateTo(docsPaths.space(space.key))}
      />
    </div>
  );
}

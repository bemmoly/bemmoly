import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useSpace } from '../hooks/queries.ts';
import type { DocsScreenProps } from '../routes.tsx';
import { docsPaths, navigateTo } from '../shared/navigation.ts';
import { PageScreenSkeleton } from '../skeletons/docs-skeletons.tsx';
import { SpaceLayout } from '../space/space-layout.tsx';
import { PageFrame } from './page-frame.tsx';
import { ABOUT_PANEL, usePageChrome } from './screen-context.ts';
import { usePageLoad } from './use-page-load.ts';

function BackToDocs() {
  return (
    <Button variant="secondary" onClick={() => navigateTo(docsPaths.home())}>
      Back to Docs
    </Button>
  );
}

/** Missing, refused or failed: one calm message in the middle of the screen. */
function Problem({ kind, retry }: { kind: 'not-found' | 'forbidden' | 'error'; retry?: () => void }) {
  const copy = {
    'not-found': {
      title: 'This page does not exist',
      description: 'It may have been deleted for good, or the link is wrong.',
    },
    forbidden: {
      title: 'You do not have access to this page',
      description: 'It is in a space you are not a member of. Ask its owner or an admin to add you.',
    },
    error: {
      title: 'This page did not load',
      description: 'The server did not answer. Your work is safe; try again in a moment.',
    },
  }[kind];
  return (
    <EmptyState
      className="flex-1 justify-center"
      icon={<Icon name={kind === 'forbidden' ? 'key' : 'doc'} />}
      title={copy.title}
      description={copy.description}
      action={
        retry ? (
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        ) : (
          <BackToDocs />
        )
      }
    />
  );
}

/**
 * The doc editor at /docs/p/:pageId, inside its space's layout with its tree row highlighted
 * and its ancestors open. The skeleton holds the screen's shape until both the page and its
 * space have answered, so the frame paints once.
 */
export default function PageScreen({ segment }: DocsScreenProps) {
  const load = usePageLoad(segment);
  const page = load.state === 'ready' ? load.page : null;
  const space = useSpace(page?.spaceKey);
  const panelOpen = usePageChrome((state) => state.panel === ABOUT_PANEL);

  if (load.state === 'not-found' || load.state === 'forbidden') return <Problem kind={load.state} />;
  if (load.state === 'error') return <Problem kind="error" retry={load.retry} />;
  if (!page || space.isPending) return <PageScreenSkeleton panel={panelOpen} />;
  return (
    <SpaceLayout
      spaceRef={page.spaceKey}
      activePageId={page.id}
      activeTrail={page.breadcrumbs.map((crumb) => crumb.id)}
      inTrash={Boolean(page.deletedAt)}
    >
      <PageFrame key={page.id} page={page} />
    </SpaceLayout>
  );
}

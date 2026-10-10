import { useFrame, useHeaderTrail } from '@bemmoly/core-web';
import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useSpace } from '../hooks/queries.ts';
import type { DocsScreenProps } from '../routes.tsx';
import { DocsLayout } from '../shared/docs-layout.tsx';
import { docsPaths, navigateTo } from '../shared/navigation.ts';
import { PageSkeleton } from '../skeletons/docs-skeletons.tsx';
import { SpaceLayout } from '../space/space-layout.tsx';
import { PageFrame } from './page-frame.tsx';
import { usePageLoad } from './use-page-load.ts';

/** Where the trail ends when there is no page to name. */
const TRAIL = { 'not-found': 'Page not found', forbidden: 'No access', error: 'Did not load' };

/** Names the problem at the end of the trail; inside the layout, where the trail is kept. */
function ProblemTrail({ kind }: { kind: keyof typeof TRAIL }) {
  const { pathname } = useFrame();
  useHeaderTrail([
    { label: 'Docs', path: docsPaths.home(), icon: <Icon name="doc" /> },
    { label: TRAIL[kind], path: pathname },
  ]);
  return null;
}

function BackToDocs({ quiet = false }: { quiet?: boolean }) {
  return (
    <Button variant={quiet ? 'ghost' : 'secondary'} onClick={() => navigateTo(docsPaths.home())}>
      Back to Docs
    </Button>
  );
}

/**
 * Missing, refused or failed: one calm message in the frame, with the sidebar and its tree
 * still there. A failure says nothing was lost and offers Retry.
 */
function Problem({
  kind,
  retry,
}: {
  kind: 'not-found' | 'forbidden' | 'error';
  retry?: () => void;
}) {
  const copy = {
    'not-found': {
      title: 'This page does not exist',
      description: 'It may have been deleted for good, or the link is wrong.',
    },
    forbidden: {
      title: 'You do not have access to this page',
      description:
        'It is in a space you are not a member of. Ask its owner or an admin to add you.',
    },
    error: {
      title: 'This page did not load',
      description: 'The server did not answer in time. Nothing you wrote was lost.',
    },
  }[kind];
  return (
    <DocsLayout layout="full">
      <ProblemTrail kind={kind} />
      <EmptyState
        headingLevel={1}
        className="flex-1 justify-center"
        icon={<Icon name={kind === 'forbidden' ? 'key' : 'doc'} />}
        title={copy.title}
        description={copy.description}
        action={
          retry ? (
            <span className="flex gap-2">
              <Button variant="primary" icon={<Icon name="refresh" size={14} />} onClick={retry}>
                Try again
              </Button>
              <BackToDocs quiet />
            </span>
          ) : (
            <BackToDocs />
          )
        }
      />
    </DocsLayout>
  );
}

/**
 * The doc editor at /docs/p/:pageId, inside its space; the sidebar marks its row and opens its
 * ancestors. The skeleton holds the screen's shape until both the page and its space have
 * answered, so the frame paints once.
 */
export default function PageScreen({ segment }: DocsScreenProps) {
  const load = usePageLoad(segment);
  const page = load.state === 'ready' ? load.page : null;
  const space = useSpace(page?.spaceKey);

  if (load.state === 'not-found' || load.state === 'forbidden')
    return <Problem kind={load.state} />;
  if (load.state === 'error') return <Problem kind="error" retry={load.retry} />;
  if (!page || space.isPending) {
    return (
      <DocsLayout layout="full">
        <PageSkeleton />
      </DocsLayout>
    );
  }
  return (
    <SpaceLayout spaceRef={page.spaceKey} layout="full">
      <PageFrame key={page.id} page={page} />
    </SpaceLayout>
  );
}

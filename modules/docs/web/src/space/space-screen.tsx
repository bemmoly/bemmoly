import { usePage, useSpace } from '../hooks/queries.ts';
import { PageArticle } from '../page/page-article.tsx';
import type { DocsScreenProps } from '../routes.tsx';
import { PageSkeleton } from '../skeletons/docs-skeletons.tsx';
import { SpaceLayout } from './space-layout.tsx';
import { SpaceOverview } from './space-overview.tsx';
import { TrashView } from './trash-view.tsx';

/** A space with a home page opens on it; one without shows the overview. */
function SpaceHome({ spaceRef }: { spaceRef: string }) {
  const space = useSpace(spaceRef);
  const homeId = space.data?.homePageId ?? undefined;
  const home = usePage(homeId);
  if (!homeId) return <SpaceOverview />;
  if (home.isPending) return <PageSkeleton />;
  if (home.isError) return <SpaceOverview />;
  return <PageArticle page={home.data} />;
}

/**
 * A space at /docs/s/ENG: the sidebar with the page tree, beside the space's home page or
 * its overview; /docs/s/ENG/trash shows the trash in the same frame.
 */
export default function SpaceScreen({ segment = '', rest }: DocsScreenProps) {
  const inTrash = rest[0] === 'trash';
  return (
    <SpaceLayout spaceRef={segment} inTrash={inTrash}>
      {inTrash ? <TrashView /> : <SpaceHome spaceRef={segment} />}
    </SpaceLayout>
  );
}

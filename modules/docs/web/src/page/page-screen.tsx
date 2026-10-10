import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { usePage } from '../hooks/queries.ts';
import type { DocsScreenProps } from '../routes.tsx';
import { docsPaths, navigateTo } from '../shared/navigation.ts';
import { SpaceSkeleton } from '../skeletons/docs-skeletons.tsx';
import { SpaceLayout } from '../space/space-layout.tsx';
import { PageArticle } from './page-article.tsx';

/**
 * A page at /docs/p/:pageId, beside its space's sidebar with its row highlighted and its
 * ancestors open. The main column is the placeholder article until the editor screen
 * lands; that screen keeps the SpaceLayout and replaces only the children.
 */
export default function PageScreen({ segment }: DocsScreenProps) {
  const page = usePage(segment);
  if (page.isPending) return <SpaceSkeleton />;
  if (page.isError) {
    return (
      <EmptyState
        className="flex-1 justify-center"
        icon={<Icon name="doc" />}
        title="This page could not be opened"
        description="It may be in the trash, or you may not have access to its space."
        action={
          <Button variant="secondary" onClick={() => navigateTo(docsPaths.home())}>
            Back to Docs
          </Button>
        }
      />
    );
  }
  return (
    <SpaceLayout
      spaceRef={page.data.spaceKey}
      activePageId={page.data.id}
      activeTrail={page.data.breadcrumbs.map((crumb) => crumb.id)}
    >
      <PageArticle page={page.data} />
    </SpaceLayout>
  );
}

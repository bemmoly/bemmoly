import { Button, Card, EmptyState } from '@bemmoly/ui';
import { useSpace, useTreeChildren } from '../hooks/queries.ts';
import { useDocsRealtime } from '../hooks/use-docs-realtime.ts';
import type { DocsScreenProps } from '../routes.tsx';
import { docsPaths, keepLinksInApp } from '../shared/navigation.ts';
import { PageRow } from '../shared/page-row.tsx';
import { PageRowsSkeleton, SpaceSkeleton } from '../skeletons/docs-skeletons.tsx';

/**
 * A space at /docs/s/ENG: a placeholder that lists the space's root pages in
 * tree order, a level at a time, until the tree sidebar and space home land.
 */
export default function SpaceScreen({ segment }: DocsScreenProps) {
  const space = useSpace(segment);
  const roots = useTreeChildren(segment);
  useDocsRealtime(space.data?.id);
  if (space.isPending) return <SpaceSkeleton />;
  if (space.isError) {
    return (
      <EmptyState
        title={`${segment ?? 'This space'} could not be opened`}
        description="It may have been deleted, or you may not be a member of it."
        action={<a href={docsPaths.home()}>Back to Docs</a>}
      />
    );
  }
  const pages = roots.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-auto" onClick={keepLinksInApp}>
      <div className="mx-auto flex max-w-310 flex-col gap-4 px-10 pt-5 pb-15">
        <div className="flex flex-col gap-1">
          <span className="text-12 text-tx4">{space.data.key}</span>
          <h1 className="m-0 text-22 font-semibold text-tx">{space.data.name}</h1>
          {space.data.description && (
            <p className="m-0 text-13 text-tx3">{space.data.description}</p>
          )}
        </div>
        {roots.isPending ? (
          <PageRowsSkeleton label="Loading pages" />
        ) : pages.length === 0 ? (
          <EmptyState
            title="This space has no pages yet"
            description="Create the first page from the New menu."
          />
        ) : (
          <Card className="overflow-hidden">
            {pages.map((page) => (
              <PageRow key={page.id} page={page} />
            ))}
          </Card>
        )}
        {roots.hasNextPage && (
          <Button
            variant="ghost"
            onClick={() => void roots.fetchNextPage()}
            disabled={roots.isFetchingNextPage}
          >
            Show more
          </Button>
        )}
      </div>
    </div>
  );
}

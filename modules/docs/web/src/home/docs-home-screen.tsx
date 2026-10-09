import { Card, EmptyState } from '@bemmoly/ui';
import { useRecentPages, useSpaces } from '../hooks/queries.ts';
import type { DocsScreenProps } from '../routes.tsx';
import { docsPaths, keepLinksInApp } from '../shared/navigation.ts';
import { PageRow } from '../shared/page-row.tsx';
import { HomeSkeleton, PageRowsSkeleton } from '../skeletons/docs-skeletons.tsx';

/**
 * The Docs home at /docs: a placeholder over the real data until the Docs
 * home screen lands. Spaces the person belongs to as cards, then the pages
 * edited most recently across them.
 */
export default function DocsHomeScreen(_props: DocsScreenProps) {
  const spaces = useSpaces();
  const recent = useRecentPages();
  if (spaces.isPending) return <HomeSkeleton />;
  const pages = recent.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-auto" onClick={keepLinksInApp}>
      <div className="mx-auto flex max-w-310 flex-col gap-6 px-10 pt-5 pb-15">
        <h1 className="m-0 text-22 font-semibold text-tx">Docs</h1>
        {spaces.isError ? (
          <EmptyState title="Spaces could not be loaded" description={spaces.error.message} />
        ) : spaces.data.length === 0 ? (
          <EmptyState
            title="No spaces yet"
            description="Spaces hold your team's pages. Create one from the New menu."
          />
        ) : (
          <section
            aria-label="Spaces"
            className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3"
          >
            {spaces.data.map((space) => (
              <a key={space.id} href={docsPaths.space(space.key)} className="no-underline">
                <Card className="flex h-22 flex-col gap-1 p-4 hover:border-br2">
                  <span className="text-14 font-semibold text-tx">{space.name}</span>
                  <span className="text-12 text-tx4">
                    {space.key} · {space.pageCount} {space.pageCount === 1 ? 'page' : 'pages'}
                  </span>
                </Card>
              </a>
            ))}
          </section>
        )}
        <section aria-label="Recent pages" className="flex flex-col gap-2">
          <h2 className="m-0 text-14 font-semibold text-tx">Recent</h2>
          {recent.isPending ? (
            <PageRowsSkeleton label="Loading recent pages" />
          ) : pages.length === 0 ? (
            <EmptyState
              size="sm"
              title="No pages yet"
              description="Pages you and your team edit show up here."
            />
          ) : (
            <Card className="overflow-hidden">
              {pages.map((page) => (
                <PageRow key={page.id} page={page} />
              ))}
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

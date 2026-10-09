import { formatRelative } from '@bemmoly/core-web';
import { EmptyState } from '@bemmoly/ui';
import { usePage } from '../hooks/queries.ts';
import { useDocsRealtime } from '../hooks/use-docs-realtime.ts';
import type { DocsScreenProps } from '../routes.tsx';
import { docsPaths, keepLinksInApp } from '../shared/navigation.ts';
import { PageSkeleton } from '../skeletons/docs-skeletons.tsx';
import { PageBody } from './page-body.tsx';

/**
 * A page at /docs/p/:pageId: the trail, title and the live body. A placeholder
 * frame until the editor screen lands; the body is the real collaborative one.
 */
export default function PageScreen({ segment }: DocsScreenProps) {
  const page = usePage(segment);
  useDocsRealtime(page.data?.spaceId);
  if (page.isPending) return <PageSkeleton />;
  if (page.isError) {
    return (
      <EmptyState
        title="This page could not be opened"
        description="It may have been deleted, or you may not have access to its space."
        action={<a href={docsPaths.home()}>Back to Docs</a>}
      />
    );
  }
  const data = page.data;

  return (
    <div className="min-h-0 flex-1 overflow-auto" onClick={keepLinksInApp}>
      <article className="mx-auto flex max-w-180 flex-col gap-3 px-10 pt-5 pb-15">
        <nav
          aria-label="Breadcrumbs"
          className="flex flex-wrap items-center gap-1 text-12 text-tx4"
        >
          <a href={docsPaths.space(data.spaceKey)} className="text-tx4 no-underline">
            {data.spaceKey}
          </a>
          {data.breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <span aria-hidden>/</span>
              <a href={docsPaths.page(crumb.id)} className="text-tx4 no-underline">
                {crumb.title || 'Untitled'}
              </a>
            </span>
          ))}
        </nav>
        <h1 className="m-0 text-26 font-semibold text-tx">
          {data.icon ? `${data.icon} ` : ''}
          {data.title || 'Untitled'}
        </h1>
        <p className="m-0 text-12 text-tx4">
          {data.owner ? `${data.owner.name} · ` : ''}
          Updated {formatRelative(data.updatedAt)} · {data.wordCount} words
        </p>
        <PageBody page={data} />
      </article>
    </div>
  );
}

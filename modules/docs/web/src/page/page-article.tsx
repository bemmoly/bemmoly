import { formatRelative } from '@bemmoly/core-web';
import type { PageDetail } from '@bemmoly/module-docs/shared';
import { PageStatusPill } from '@bemmoly/ui';
import { isIconName } from '@bemmoly/ui/icons';
import { docsPaths } from '../shared/navigation.ts';
import { PageBody } from './page-body.tsx';

/**
 * A page in the main column: its trail, title, a line about it and the live body. The doc
 * editor screen replaces this with the full editor frame; until then it is what a page
 * shows beside the space sidebar, and what a space with a home page opens on.
 */
export function PageArticle({ page }: { page: PageDetail }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-sf">
      <article className="mx-auto flex max-w-180 flex-col gap-3 px-10 pt-12 pb-30">
        <nav
          aria-label="Breadcrumbs"
          className="flex flex-wrap items-center gap-1.5 text-12h text-tx4"
        >
          <a href={docsPaths.space(page.spaceKey)} className="text-tx4 no-underline">
            {page.spaceKey}
          </a>
          {page.breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1.5">
              <span aria-hidden>/</span>
              <a href={docsPaths.page(crumb.id)} className="text-tx4 no-underline">
                {crumb.title || 'Untitled'}
              </a>
            </span>
          ))}
          <PageStatusPill status={page.status} className="ml-2" />
        </nav>
        <h1 className="m-0 text-36 leading-title font-semibold tracking-display text-tx">
          {page.icon && !isIconName(page.icon) ? `${page.icon} ` : ''}
          {page.title || 'Untitled'}
        </h1>
        <p className="m-0 border-b border-br-row pb-1.5 text-12h text-tx5">
          {page.owner ? `${page.owner.name} · ` : ''}
          Edited {formatRelative(page.updatedAt)} · {page.wordCount}{' '}
          {page.wordCount === 1 ? 'word' : 'words'}
        </p>
        <PageBody page={page} />
      </article>
    </div>
  );
}

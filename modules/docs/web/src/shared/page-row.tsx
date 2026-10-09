import { formatRelative } from '@bemmoly/core-web';
import type { PageStatus, PageSummary } from '@bemmoly/module-docs/shared';
import { docsPaths } from './navigation.ts';

const STATUS_LABEL: Record<PageStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  published: 'Published',
  archived: 'Archived',
};

/** One page in a list: icon, title, space key, status and when it last changed. */
export function PageRow({ page }: { page: PageSummary }) {
  return (
    <a
      href={docsPaths.page(page.id)}
      className="flex items-center gap-2.5 border-b border-br px-3 py-2.5 text-13 text-tx no-underline hover:bg-sf2"
    >
      <span aria-hidden className="w-4 text-center">
        {page.icon ?? '·'}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{page.title || 'Untitled'}</span>
      <span className="text-12 text-tx4">{page.spaceKey}</span>
      <span className="text-12 text-tx4">{STATUS_LABEL[page.status]}</span>
      <span className="w-20 text-right text-12 text-tx5">{formatRelative(page.updatedAt)}</span>
    </a>
  );
}

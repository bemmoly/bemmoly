import type { HomePage, PageSummary } from '@bemmoly/module-docs/shared';
import {
  Avatar,
  Card,
  DocListRowSkeleton,
  RelativeTime,
  Skeleton,
  type PageTreeItem,
} from '@bemmoly/ui';
import { Icon, PageIcon } from '@bemmoly/ui/icons';
import { moveInList, PageRow, PageStatusGlyph } from '../../home/page-row.tsx';
import { docsPaths } from '../../shared/navigation.ts';
import type { DocsPersonView } from '../../shared/people.ts';
import { isStale, STALE_DAYS } from './use-overview.ts';

const HEAD = 'flex items-center gap-2 border-b border-line-2 px-3.5 py-2.5';

/** Pages waiting on a reviewer, and how many nobody has touched for 90 days. */
export function InReview({
  pages,
  pending,
  person,
}: {
  pages: readonly HomePage[];
  pending: boolean;
  person: (id: string | null) => DocsPersonView | null;
}) {
  const waiting = pages.filter((page) => page.status === 'in_review');
  const stale = pages.filter((page) => isStale(page) && page.status !== 'archived');
  return (
    <Card className="flex min-w-0 flex-col overflow-hidden">
      <div className={HEAD}>
        <h2 className="m-0 flex-1 text-13 font-semibold text-tx">In review</h2>
        <span className="text-12 text-tx-3 tabular-nums">{pending ? '' : waiting.length}</span>
      </div>
      {pending ? (
        <DocListRowSkeleton rows={2} />
      ) : waiting.length === 0 ? (
        <p className="m-0 px-3.5 py-3 text-13 text-tx-3">Nothing is waiting on a reviewer.</p>
      ) : (
        waiting.slice(0, 3).map((page) => {
          const owner = person(page.ownerId);
          return (
            <a
              key={page.id}
              href={docsPaths.page(page.id)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-tx no-underline hover:bg-hover"
            >
              <PageIcon value={page.icon} size={16} className="text-tx-3" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-13 font-semibold">{page.title || 'Untitled'}</span>
                <span className="truncate text-12 text-tx-3">
                  {owner ? `${owner.name} asked for review` : 'Waiting for review'}
                </span>
              </span>
              <PageStatusGlyph status={page.status} />
            </a>
          );
        })
      )}
      {stale.length > 0 && (
        <p className="m-0 mt-auto flex items-center gap-2 border-t border-line-2 px-3.5 py-2.5 text-13 text-tx-2">
          <Icon name="clock" size={14} className="text-amber" />
          {stale.length} {stale.length === 1 ? 'page' : 'pages'} not updated for {STALE_DAYS} days
        </p>
      )}
    </Card>
  );
}

/** Top-level pages as cards: icon, title, a line about it, its owner and when it changed. */
export function TopPages({
  roots,
  summaries,
  person,
}: {
  roots: readonly PageTreeItem[];
  summaries: ReadonlyMap<string, PageSummary>;
  person: (id: string | null) => DocsPersonView | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {roots.map((root) => {
        const page = summaries.get(root.id);
        const owner = person(page?.ownerId ?? null);
        return (
          <a
            key={root.id}
            href={docsPaths.page(root.id)}
            className="flex min-w-0 flex-col gap-2.5 rounded-card border border-line bg-card p-3.5 text-tx no-underline outline-0 hover:border-line hover:shadow-e1 focus-visible:border-acc focus-visible:shadow-ring"
          >
            <span className="flex items-center gap-2">
              <PageIcon value={root.icon} size={18} className="text-tx-2" />
              <span className="min-w-0 flex-1 truncate text-13 font-semibold">
                {root.title || 'Untitled'}
              </span>
              {page && <PageStatusGlyph status={page.status} />}
            </span>
            <span className="text-12 text-tx-3">
              {root.hasChildren ? 'Has pages under it' : 'A single page'}
            </span>
            <span className="flex items-center gap-1.5 text-12 text-tx-3">
              {owner && <Avatar name={owner.name} size={16} />}
              {page ? (
                <span>
                  Updated <RelativeTime iso={page.updatedAt} />
                </span>
              ) : (
                <Skeleton width={80} height={10} />
              )}
            </span>
          </a>
        );
      })}
    </div>
  );
}

/** Who changed what in the space, newest first. */
export function RecentlyUpdated({
  pages,
  pending,
  meId,
}: {
  pages: readonly HomePage[];
  pending: boolean;
  meId: string | null;
}) {
  return (
    <Card className="overflow-hidden">
      <div role="list" aria-label="Recently updated" onKeyDown={moveInList}>
        {pending ? (
          <DocListRowSkeleton rows={4} />
        ) : (
          pages.slice(0, 8).map((page) => {
            const editor = page.lastEditor;
            const who = editor ? (editor.id === meId ? 'You' : editor.name) : 'Someone';
            return (
              <div role="listitem" key={page.id}>
                <PageRow
                  page={page}
                  place={<span className="truncate">{who} edited</span>}
                  person={editor}
                  when={page.updatedAt}
                />
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

import type { PageTreeItem } from '@bemmoly/ui';
import { plainText } from '@bemmoly/editor/convert';
import type { RichTextDoc } from '@bemmoly/editor';
import type { Space } from '@bemmoly/module-docs/shared';
import { Card, Menu, MenuItem, Skeleton } from '@bemmoly/ui';
import { Icon, PageIcon } from '@bemmoly/ui/icons';
import { useOutgoingLinks } from '../../links/use-links.ts';
import { docsPaths } from '../../shared/navigation.ts';
import { useHomePage, useSetHomePage } from './use-overview.ts';

const LABEL = 'flex items-center gap-2 text-12 font-semibold text-tx-3';
const CHIP =
  'inline-flex h-7 max-w-56 min-w-0 items-center gap-1.5 rounded-control border border-line px-2.5 text-13 font-medium text-tx no-underline hover:bg-hover focus-ring';

/** The pages the home page links to, as the way in a newcomer is pointed at. */
function PointsTo({ pageId }: { pageId: string }) {
  const links = useOutgoingLinks(pageId);
  const pages = (links.data ?? []).flatMap((link) =>
    link.targetKind === 'page' && link.page ? [link.page] : [],
  );
  if (pages.length === 0) return null;
  return (
    <nav aria-label="Pages it points to" className="flex flex-wrap gap-1.5 pt-1">
      {pages.slice(0, 4).map((page) => (
        <a key={page.pageId} href={docsPaths.page(page.pageId)} className={CHIP}>
          <PageIcon value={page.icon} size={14} className="shrink-0 text-tx-3" />
          <span className="truncate">{page.title || 'Untitled'}</span>
        </a>
      ))}
    </nav>
  );
}

/**
 * Start here: the space's home page, pinned, with its opening lines and the pages it links to.
 * Without one, the first
 * top-level page stands in until someone picks. Change sets another, for those who may
 * configure the space.
 */
export function StartHere({
  space,
  roots,
  canChange,
}: {
  space: Space;
  roots: readonly PageTreeItem[];
  canChange: boolean;
}) {
  const pinned = space.homePageId;
  const shownId = pinned ?? roots[0]?.id ?? null;
  const home = useHomePage(shownId);
  const change = useSetHomePage(space);
  const lines = home.data ? plainText(home.data.snapshot as RichTextDoc | null).slice(0, 320) : '';

  return (
    <Card className="flex min-w-0 flex-col gap-2 px-5 py-4.5">
      <div className={LABEL}>
        <Icon name="home" size={13} />
        <span className="flex-1">{pinned ? 'Start here' : 'Start here, until you pin a page'}</span>
        {canChange && roots.length > 0 && (
          <Menu
            align="end"
            trigger={(trigger) => (
              <button
                {...trigger}
                type="button"
                className="cursor-pointer rounded-chip border-0 bg-transparent px-1.5 py-0.5 font-sans text-12 font-medium text-tx-2 hover:bg-hover hover:text-tx"
              >
                {pinned ? 'Change' : 'Pin a page'}
              </button>
            )}
          >
            {roots.map((root) => (
              <MenuItem
                key={root.id}
                icon={<PageIcon value={root.icon} size={14} />}
                checked={root.id === pinned}
                onSelect={() => change.mutate(root.id)}
              >
                {root.title || 'Untitled'}
              </MenuItem>
            ))}
          </Menu>
        )}
      </div>
      {home.isPending && shownId ? (
        <div className="flex flex-col gap-2.5 pt-1">
          <Skeleton width={180} height={16} />
          <Skeleton width="92%" height={11} />
          <Skeleton width="70%" height={11} />
        </div>
      ) : home.data ? (
        <>
          <a
            href={docsPaths.page(home.data.id)}
            className="flex items-center gap-2.5 text-16 font-semibold tracking-display text-tx no-underline hover:text-acc"
          >
            <PageIcon value={home.data.icon} size={20} />
            <span className="truncate">{home.data.title || 'Untitled'}</span>
          </a>
          <p className="m-0 line-clamp-3 text-13 leading-body text-tx-2">
            {lines || 'Nothing written on this page yet.'}
          </p>
          <PointsTo pageId={home.data.id} />
        </>
      ) : (
        <p className="m-0 text-13 text-tx-3">
          {home.isError ? 'The home page didn’t load.' : 'No pages yet.'}
        </p>
      )}
    </Card>
  );
}

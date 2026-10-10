import type { PageTreeItem } from '@bemmoly/ui';
import { plainText } from '@bemmoly/editor/convert';
import type { RichTextDoc } from '@bemmoly/editor';
import type { Space } from '@bemmoly/module-docs/shared';
import { Card, Menu, MenuItem, Skeleton } from '@bemmoly/ui';
import { Icon, PageIcon } from '@bemmoly/ui/icons';
import { docsPaths } from '../../shared/navigation.ts';
import { useHomePage, useSetHomePage } from './use-overview.ts';

const LABEL = 'flex items-center gap-2 text-12 font-semibold text-tx4';

/**
 * Start here: the space's home page, pinned, with its opening lines. Without one, the first
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
                className="cursor-pointer rounded-sm border-0 bg-transparent px-1.5 py-0.5 font-sans text-12 font-medium text-tx3 hover:bg-hover hover:text-tx"
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
            className="flex items-center gap-2.5 text-16 font-semibold tracking-display text-tx no-underline hover:text-ac"
          >
            <PageIcon value={home.data.icon} size={20} />
            <span className="truncate">{home.data.title || 'Untitled'}</span>
          </a>
          <p className="m-0 line-clamp-3 text-13 leading-body text-tx3">
            {lines || 'Nothing written on this page yet.'}
          </p>
        </>
      ) : (
        <p className="m-0 text-13 text-tx4">
          {home.isError ? 'The home page didn’t load.' : 'No pages yet.'}
        </p>
      )}
    </Card>
  );
}

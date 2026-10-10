import {
  SidebarRow,
  useFrame,
  useSidebarTakeover,
  type ModuleSidebarProps,
} from '@bemmoly/core-web';
import { Button } from '@bemmoly/ui';
import { useEffect } from 'react';
import { useSpaces } from './hooks/queries.ts';
import { docsPaths } from './shared/navigation.ts';
import { SidebarFocus } from './space/sidebar-focus.tsx';
import { useDocsPlace } from './space/sidebar-place.ts';
import { SidebarSpace } from './space/sidebar-space.tsx';
import { useTreeFocus, useTreeOpen } from './space/tree-store.ts';

/** How many spaces the sidebar lists; the current one is always among them. */
const SHOWN = 6;

/**
 * Docs' live sidebar rows (docs/design/premium/docs/docs-tree.js, option A): the spaces as rows
 * like projects, the current one opened to its page tree, then Docs home. A focused space takes
 * the whole sidebar, with a filter. On the rail each space is its tile.
 */
export default function DocsSidebar({ manifest }: ModuleSidebarProps) {
  const { mode, pathname } = useFrame();
  const spaces = useSpaces();
  const place = useDocsPlace(pathname);
  const [focus, setFocus] = useTreeFocus();
  const reveal = useTreeOpen((state) => state.reveal);
  const trail = place.trail.join('/');
  const list = spaces.data ?? [];
  const current = list.find((space) => space.key.toLowerCase() === place.spaceKey?.toLowerCase());

  // Opening a page from search or a link opens its ancestors, so its row shows.
  useEffect(() => {
    if (current && trail) reveal(current.key, trail.split('/'));
  }, [current, trail, reveal]);

  const focused = mode === 'rail' ? undefined : list.find((space) => space.key === focus);
  // Focus mode takes the whole sidebar, as the review draws it, not only the Docs section.
  useSidebarTakeover(manifest.id, Boolean(focused));

  if (spaces.isError) {
    return mode === 'rail' ? null : (
      <div className="flex items-center gap-2 px-2 py-1 text-12 text-tx-3">
        <span className="min-w-0 flex-1">Spaces did not load.</span>
        <Button size="sm" variant="ghost" onClick={() => void spaces.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (focused) {
    return (
      <SidebarFocus space={focused} activePageId={place.pageId} onExit={() => setFocus(null)} />
    );
  }

  const shown = list.slice(0, SHOWN);
  if (current && !shown.includes(current)) shown.splice(SHOWN - 1, 1, current);
  return (
    <>
      {shown.map((space) => (
        <SidebarSpace
          key={space.id}
          space={space}
          open={space === current}
          here={space === current && !place.pageId}
          activePageId={space === current ? place.pageId : undefined}
          onFocus={() => setFocus(space.key)}
        />
      ))}
      <SidebarRow label="Docs home" icon="grid" path={docsPaths.home()} exact />
    </>
  );
}

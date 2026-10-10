import { HeaderActions, useHeaderTrail, type PageCrumb } from '@bemmoly/core-web';
import { AvatarStack, IconButton } from '@bemmoly/ui';
import { PageIcon } from '@bemmoly/ui/icons';
import { useStarPage } from '../../hooks/mutations.ts';
import { docsPaths } from '../../shared/navigation.ts';
import { SpaceTile } from '../../space/space-tile.tsx';
import { useSpaceActions } from '../../space/space-layout.tsx';
import { MarginToggles } from '../panel/margin-toggles.tsx';
import { SharePopover } from '../share/share-popover.tsx';
import { usePageScreen } from '../screen-context.ts';
import { MoreMenu } from './more-menu.tsx';
import { saveLine, saveState, spokenState } from './save-state.ts';

const TONE = { quiet: 'text-tx-3', busy: 'text-tx-2', warn: 'text-amber-tx' } as const;

/** "Saved · Priya is editing" and the faces of everyone else on the page. */
function Presence() {
  const { collab, readOnly } = usePageScreen();
  const state = saveState(collab, readOnly);
  const names = collab.peers.map((peer) => peer.name).join(', ');
  return (
    <>
      <span
        aria-hidden
        data-save-state={collab.status}
        className={`hidden truncate text-12 whitespace-nowrap sm:inline ${TONE[state.tone]}`}
      >
        {saveLine(state)}
      </span>
      {/* Read out on every change, phones included; without the Saving… of every keystroke. */}
      <span role="status" className="sr-only">
        {saveLine(spokenState(state))}
      </span>
      {collab.peers.length > 0 && (
        <span title={names} className="hidden sm:inline-flex">
          <AvatarStack
            label={`Also here: ${names}`}
            size={24}
            max={4}
            people={collab.peers.map((peer) => ({
              id: peer.id,
              name: peer.name,
              initials: peer.initials,
              hue: peer.hue,
            }))}
          />
        </span>
      )}
    </>
  );
}

function StarButton() {
  const { page, readOnly } = usePageScreen();
  const star = useStarPage(page.id);
  if (readOnly === 'trashed') return null;
  return (
    <IconButton
      label={page.starred ? 'Remove from starred' : 'Star this page'}
      icon="star"
      size="sm"
      variant="ghost"
      aria-pressed={page.starred}
      className="max-sm:hidden aria-pressed:text-amber-fg [&[aria-pressed=true]_svg]:fill-current"
      onClick={() => star.mutate(!page.starred)}
    />
  );
}

/**
 * The page's trail in the frame's header: space › parents › page, each with its tile or icon
 * and each a link, replacing the route's placeholder once the page has loaded.
 */
export function usePageTrail() {
  const { page } = usePageScreen();
  const { space } = useSpaceActions();
  const crumbs: PageCrumb[] = [
    {
      label: space.name,
      path: docsPaths.space(space.key),
      icon: <SpaceTile space={space} size={16} />,
    },
    ...page.breadcrumbs.map((crumb) => ({
      label: crumb.title || 'Untitled',
      path: docsPaths.page(crumb.id),
      icon: <PageIcon value={crumb.icon} size={14} className="text-tx-3" />,
    })),
    {
      label: page.title || 'Untitled',
      path: docsPaths.page(page.id),
      icon: <PageIcon value={page.icon} size={14} className="text-tx-3" />,
    },
  ];
  useHeaderTrail(crumbs);
}

/**
 * The page's part of the frame's one header (no bar of its own): the trail and, after it, the
 * status menu (page-frame.tsx), then on the right the save line, the people here, star, the
 * margin toggles, Share and ···. On a phone the quieter parts fold away.
 */
export function PageHeaderActions() {
  usePageTrail();

  return (
    <HeaderActions>
      <Presence />
      <StarButton />
      <MarginToggles />
      <span className="hidden md:inline-flex">
        <SharePopover />
      </span>
      <MoreMenu />
    </HeaderActions>
  );
}

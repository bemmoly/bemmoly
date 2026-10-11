import {
  HeaderActions,
  HeaderPresence,
  PresenceFacepile,
  useHeaderTrail,
  type PageCrumb,
  type PresencePerson,
} from '@bemmoly/core-web';
import { IconButton } from '@bemmoly/ui';
import { PageIcon } from '@bemmoly/ui/icons';
import { useMemo } from 'react';
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

/** "Saved · Priya is editing", beside the actions; the faces are in the presence slot. */
function SaveLine() {
  const { collab, readOnly } = usePageScreen();
  const state = saveState(collab, readOnly);
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
    </>
  );
}

/**
 * Everyone else on the page, drawn as Work draws the people on a board: the header's facepile,
 * before the actions, and nothing on a phone. The people come from the page's own session.
 */
function PageFaces() {
  const { collab } = usePageScreen();
  const people = useMemo(
    () =>
      collab.peers.map((peer): PresencePerson => ({
        id: peer.id,
        name: peer.name,
        where: 'on this page',
        hue: peer.hue,
      })),
    [collab.peers],
  );
  return (
    <HeaderPresence>
      <PresenceFacepile people={people} />
    </HeaderPresence>
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
 * status menu (page-frame.tsx), then on the right the people here, the save line, star, the
 * margin toggles, Share and ···. On a phone the quieter parts fold away.
 */
export function PageHeaderActions() {
  usePageTrail();

  return (
    <>
      <PageFaces />
      <HeaderActions>
        <SaveLine />
        <StarButton />
        <MarginToggles />
        <span className="hidden md:inline-flex">
          <SharePopover />
        </span>
        <MoreMenu />
      </HeaderActions>
    </>
  );
}

import { HeaderActions, useHeaderTrail, type PageCrumb } from '@bemmoly/core-web';
import { AvatarStack, Button, IconButton } from '@bemmoly/ui';
import { Icon, PageIcon } from '@bemmoly/ui/icons';
import { useStarPage } from '../../hooks/mutations.ts';
import { docsPaths } from '../../shared/navigation.ts';
import { SpaceTile } from '../../space/space-tile.tsx';
import { useSpaceActions } from '../../space/space-layout.tsx';
import { ABOUT_PANEL, usePageChrome, usePageScreen } from '../screen-context.ts';
import { PANEL_SLOTS } from '../slots.ts';
import { MoreMenu, useCopyLink } from './more-menu.tsx';
import { saveLine, saveState, spokenState } from './save-state.ts';

const TONE = { quiet: 'text-tx-3', busy: 'text-tx-2', warn: 'text-warn-fg' } as const;

/** Pressed panel toggles take the mock's open-panel look: accent ink on the accent wash. */
const TOGGLE = 'aria-pressed:border-acc aria-pressed:bg-acc-50 aria-pressed:text-acc';

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
      className="aria-pressed:text-amber-fg [&[aria-pressed=true]_svg]:fill-current"
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
 * status menu (page-frame.tsx), then on the right the save line, the people here, star, Share,
 * the panel toggles and ···. On a phone the quieter parts fold away.
 */
export function PageHeaderActions() {
  const { page } = usePageScreen();
  const panel = usePageChrome((state) => state.panel);
  const togglePanel = usePageChrome((state) => state.togglePanel);
  const copyLink = useCopyLink(page.id);
  const toggles = PANEL_SLOTS.filter((slot) => slot.header);
  usePageTrail();

  return (
    <HeaderActions>
      <Presence />
      <StarButton />
      <span className="hidden md:inline-flex">
        <Button size="sm" icon={<Icon name="link" size={14} />} onClick={() => void copyLink()}>
          Share
        </Button>
      </span>
      {toggles.map((slot) => (
        <Button
          key={slot.id}
          size="sm"
          aria-pressed={panel === slot.id}
          icon={slot.header ? <Icon name={slot.header.icon} size={14} /> : undefined}
          className={TOGGLE}
          onClick={() => togglePanel(slot.id)}
        >
          <span className="max-lg:sr-only">{slot.header?.label}</span>
        </Button>
      ))}
      <Button
        size="sm"
        aria-pressed={panel === ABOUT_PANEL}
        aria-keyshortcuts="Meta+Period"
        icon={<Icon name="lines" size={14} />}
        className={TOGGLE}
        onClick={() => togglePanel(ABOUT_PANEL)}
      >
        <span className="max-lg:sr-only">About</span>
      </Button>
      <MoreMenu />
    </HeaderActions>
  );
}

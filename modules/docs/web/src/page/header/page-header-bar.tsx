import { AvatarStack, Breadcrumbs, Button, IconButton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useStarPage } from '../../hooks/mutations.ts';
import { docsPaths } from '../../shared/navigation.ts';
import { useSpaceActions } from '../../space/space-layout.tsx';
import { ABOUT_PANEL, usePageChrome, usePageScreen } from '../screen-context.ts';
import { PANEL_SLOTS } from '../slots.ts';
import { MoreMenu, useCopyLink } from './more-menu.tsx';
import { saveLine, saveState } from './save-state.ts';
import { StatusMenu } from './status-menu.tsx';

const TONE = { quiet: 'text-tx5', busy: 'text-tx4', warn: 'text-warn-fg' } as const;

/** Pressed panel toggles take the mock's open-panel look: accent ink on the accent wash. */
const TOGGLE = 'aria-pressed:border-ac-br aria-pressed:bg-ac-bg aria-pressed:text-ac';

/** "Saved · Priya is editing" and the faces of everyone else on the page. */
function Presence() {
  const { collab, readOnly } = usePageScreen();
  const state = saveState(collab, readOnly);
  const names = collab.peers.map((peer) => peer.name).join(', ');
  return (
    <>
      <span
        role="status"
        data-save-state={collab.status}
        className={`hidden truncate text-12 whitespace-nowrap sm:inline ${TONE[state.tone]}`}
      >
        {saveLine(state)}
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
 * The 44px bar over the body: the trail and status on the left; the save line, the people
 * here, star, Share, the panel toggles and ··· on the right. Below 768px the trail keeps only
 * the page and the quieter parts fold away.
 */
export function PageHeaderBar() {
  const { page } = usePageScreen();
  const { space } = useSpaceActions();
  const panel = usePageChrome((state) => state.panel);
  const togglePanel = usePageChrome((state) => state.togglePanel);
  const copyLink = useCopyLink(page.id);
  const toggles = PANEL_SLOTS.filter((slot) => slot.header);

  return (
    <header className="flex h-11 shrink-0 items-center gap-2.5 border-b border-br bg-sf px-4 text-12h text-tx4 sm:px-5">
      <Breadcrumbs
        strongCurrent
        className="min-w-0 [&_li]:shrink-0 [&_li:last-child]:min-w-0 [&_li:last-child]:shrink [&_li:last-child>span]:block [&_li:last-child>span]:truncate [&_ol]:flex-nowrap max-md:[&_li:not(:last-child)]:hidden"
        items={[
          { label: space.name, href: docsPaths.space(space.key) },
          ...page.breadcrumbs.map((crumb) => ({
            label: crumb.title || 'Untitled',
            href: docsPaths.page(crumb.id),
          })),
          { label: page.title || 'Untitled' },
        ]}
      />
      <StatusMenu />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Presence />
        <StarButton />
        <span className="hidden md:inline-flex">
          <Button size="sm" onClick={() => void copyLink()}>
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
            <span className="max-sm:sr-only">{slot.header?.label}</span>
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
          <span className="max-sm:sr-only">About</span>
        </Button>
        <MoreMenu />
      </div>
    </header>
  );
}

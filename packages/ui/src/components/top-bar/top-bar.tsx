import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { Icon, ICON_SIZE, type IconName } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { caretTone, focusRing } from '../../lib/focus.ts';
import { AiAskButton } from '../ai-surface/ai-parts.tsx';
import { Avatar, type AvatarHue } from '../avatar/avatar.tsx';
import { Button } from '../button/button.tsx';
import { IconButton } from '../button/icon-button.tsx';
import { Logo } from '../logo/logo.tsx';
import { Menu } from '../menu/menu.tsx';

export interface TopBarNavItem {
  id: string;
  label: string;
  active?: boolean;
  /**
   * The menu this item opens. Only items with one show the caret: the mocks put ▾ on every
   * item, which reads as broken when nothing opens.
   */
  menu?: ReactNode;
  /** Shows the caret for an item that opens its own menu from onClick. */
  hasMenu?: boolean;
  href?: string;
  linkProps?: Record<string, unknown>;
  onClick?: () => void;
}

export interface TopBarProps {
  nav: readonly TopBarNavItem[];
  /** Router link component for items with href or linkProps; defaults to <a>. */
  linkAs?: ElementType;
  /** Where the brand block links; omit for a plain block. */
  homeHref?: string;
  onCreate?: () => void;
  /** What Create opens: CreateMenuItem rows, or CreateMenuEmpty. Takes precedence over onCreate. */
  createMenu?: ReactNode;
  createLabel?: string;
  /** Opens search (the command palette in search mode). */
  onSearch?: () => void;
  searchPlaceholder?: string;
  /** Opens the AI command palette; hidden when AI is off for the workspace or the person. */
  onAsk?: () => void;
  inboxCount?: number;
  onInbox?: () => void;
  onHelp?: () => void;
  onSettings?: () => void;
  user: { name: string; initials?: string; hue?: AvatarHue };
  onUser?: () => void;
  /** Extra controls before the user avatar. */
  extra?: ReactNode;
  className?: string;
}

/** The top bar's icon buttons draw at the bar size (18px), like the sidebar. */
export const barIcon = (name: IconName) => <Icon name={name} size={ICON_SIZE.bar} />;

const navClass = (active: boolean | undefined) =>
  cx(
    'group inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent px-2.5 py-1.5 font-sans text-nav whitespace-nowrap no-underline',
    active
      ? 'rounded-none font-medium text-tx shadow-tab'
      : 'rounded-control text-tx2 hover:bg-bg2',
    focusRing,
  );

const caret = <Icon name="caret" className={caretTone} />;

function NavItem({ item, linkAs }: { item: TopBarNavItem; linkAs: ElementType }) {
  if (item.menu)
    return (
      <Menu
        widthClassName="w-64"
        trigger={(props) => (
          <button
            type="button"
            {...props}
            data-active={item.active || undefined}
            className={navClass(item.active)}
          >
            {item.label}
            {caret}
          </button>
        )}
      >
        {item.menu}
      </Menu>
    );
  const Component: ElementType = item.href || item.linkProps ? linkAs : 'button';
  const isButton = Component === 'button';
  return (
    <Component
      {...(isButton ? { type: 'button' } : { href: item.href })}
      {...item.linkProps}
      onClick={item.onClick}
      aria-current={item.active ? 'page' : undefined}
      data-active={item.active || undefined}
      className={navClass(item.active)}
    >
      {item.label}
      {item.hasMenu && caret}
    </Component>
  );
}

function CreateButton({
  label,
  menu,
  onCreate,
}: {
  label: string;
  menu?: ReactNode;
  onCreate?: () => void;
}) {
  if (!menu)
    return (
      <Button variant="primary" size="bar" className="ml-1.5 shrink-0" onClick={onCreate}>
        {label}
      </Button>
    );
  return (
    <Menu
      className="ml-1.5 shrink-0"
      widthClassName="w-90"
      trigger={(props) => (
        <Button variant="primary" size="bar" {...props}>
          {label}
        </Button>
      )}
    >
      {menu}
    </Menu>
  );
}

/** The app's top bar, as in every product mock. */
export function TopBar({
  nav,
  linkAs = 'a',
  homeHref,
  onCreate,
  createMenu,
  createLabel = 'Create',
  onSearch,
  searchPlaceholder = 'Search issues, docs, people',
  onAsk,
  inboxCount,
  onInbox,
  onHelp,
  onSettings,
  user,
  onUser,
  extra,
  className,
}: TopBarProps) {
  const Brand: ElementType = homeHref ? linkAs : 'div';
  const navRef = useRef<HTMLElement>(null);
  const activeId = nav.find((item) => item.active)?.id;
  // Where the items scroll (a phone), keep the current one in view.
  useEffect(() => {
    navRef.current
      ?.querySelector('[data-active]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeId]);
  return (
    <header
      className={cx(
        'flex h-topbar min-w-0 shrink-0 items-center gap-1 border-b border-br bg-sf pr-3 pl-4 max-sm:pr-2 max-sm:pl-3',
        className,
      )}
    >
      <Brand
        {...(homeHref ? { href: homeHref, 'aria-label': 'Bemmoly home' } : {})}
        className={cx(
          'mr-1.5 flex h-7 shrink-0 items-center border-r border-br pr-3.5 no-underline max-sm:mr-0.5 max-sm:pr-2.5',
          homeHref && focusRing,
        )}
      >
        <Logo variant="lockup" label={homeHref ? '' : 'Bemmoly'} className="max-sm:hidden" />
        <Logo label={homeHref ? '' : 'Bemmoly'} className="sm:hidden" />
      </Brand>
      {/* On a phone the items scroll sideways inside the bar instead of pushing the page wider;
          the padding keeps the focus outline inside the scroll box. */}
      <nav
        ref={navRef}
        aria-label="Main"
        className="-mx-1 flex min-w-0 gap-0.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]"
      >
        {nav.map((item) => (
          <NavItem key={item.id} item={item} linkAs={linkAs} />
        ))}
      </nav>
      {(onCreate || createMenu) && (
        <CreateButton label={createLabel} menu={createMenu} onCreate={onCreate} />
      )}
      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 max-sm:gap-1 md:shrink">
        {onSearch && (
          <button
            type="button"
            onClick={onSearch}
            aria-keyshortcuts="/"
            aria-label={searchPlaceholder}
            className={cx(
              'flex h-control w-75 min-w-20 shrink cursor-pointer items-center gap-2 rounded-control border border-br3 bg-bg2 px-2.5 font-sans text-13 text-tx5',
              'max-md:w-control max-md:min-w-0 max-md:justify-center max-md:px-0',
              focusRing,
            )}
          >
            <Icon name="search" />
            <span className="truncate max-md:hidden">{searchPlaceholder}</span>
            <kbd className="ml-auto shrink-0 font-mono text-11 font-medium text-tx6 max-md:hidden">
              /
            </kbd>
          </button>
        )}
        {onAsk && <AiAskButton shortcut="⌘K" onClick={onAsk} className="max-sm:hidden" />}
        {onInbox && (
          <IconButton
            label="Inbox"
            icon={barIcon('inbox')}
            {...(inboxCount ? { badge: inboxCount } : {})}
            onClick={onInbox}
          />
        )}
        {onHelp && <IconButton label="Help" icon={barIcon('help')} onClick={onHelp} />}
        {onSettings && (
          <IconButton label="Settings" icon={barIcon('settings')} onClick={onSettings} />
        )}
        {extra}
        <button
          type="button"
          onClick={onUser}
          aria-label={`Account: ${user.name}`}
          className={cx('ml-1 cursor-pointer rounded-full border-0 bg-transparent p-0', focusRing)}
        >
          <Avatar
            name={user.name}
            size={30}
            prominent
            hue={user.hue ?? 'accent'}
            {...(user.initials ? { initials: user.initials } : {})}
          />
        </button>
      </div>
    </header>
  );
}

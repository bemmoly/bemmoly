import type { ElementType, ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { AiAskButton } from '../ai-surface/ai-parts.tsx';
import { Avatar, type AvatarHue } from '../avatar/avatar.tsx';
import { Button } from '../button/button.tsx';
import { IconButton } from '../button/icon-button.tsx';
import { Logo } from '../logo/logo.tsx';

export interface TopBarNavItem {
  id: string;
  label: string;
  active?: boolean;
  /** Shows the ▾ that marks items with a menu (every item in the mocks). */
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

function NavItem({ item, linkAs }: { item: TopBarNavItem; linkAs: ElementType }) {
  const Component: ElementType = item.href || item.linkProps ? linkAs : 'button';
  const isButton = Component === 'button';
  return (
    <Component
      {...(isButton ? { type: 'button' } : { href: item.href })}
      {...item.linkProps}
      onClick={item.onClick}
      aria-current={item.active ? 'page' : undefined}
      className={cx(
        'cursor-pointer border-0 bg-transparent px-2.5 py-1.5 font-sans text-nav whitespace-nowrap no-underline',
        item.active
          ? 'rounded-none font-medium text-tx shadow-tab'
          : 'rounded-control text-tx2 hover:bg-bg2',
        focusRing,
      )}
    >
      {item.label}
      {item.hasMenu !== false && (
        <>
          {' '}
          <Icon name="caret" className="text-tx5" />
        </>
      )}
    </Component>
  );
}

/** The app's top bar, as in every product mock. */
export function TopBar({
  nav,
  linkAs = 'a',
  homeHref,
  onCreate,
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
  return (
    <header
      className={cx(
        'flex h-topbar shrink-0 items-center gap-1 border-b border-br bg-sf pr-3 pl-4',
        className,
      )}
    >
      <Brand
        {...(homeHref ? { href: homeHref, 'aria-label': 'Bemmoly home' } : {})}
        className={cx(
          'mr-1.5 flex h-7 items-center border-r border-br pr-3.5 no-underline',
          homeHref && focusRing,
        )}
      >
        <Logo variant="lockup" label={homeHref ? '' : 'Bemmoly'} />
      </Brand>
      <nav aria-label="Main" className="flex gap-0.5">
        {nav.map((item) => (
          <NavItem key={item.id} item={item} linkAs={linkAs} />
        ))}
      </nav>
      {onCreate && (
        <Button variant="primary" size="bar" className="ml-1.5" onClick={onCreate}>
          {createLabel}
        </Button>
      )}
      <div className="ml-auto flex min-w-0 items-center gap-2">
        {onSearch && (
          <button
            type="button"
            onClick={onSearch}
            aria-keyshortcuts="/"
            className={cx(
              'flex h-control w-75 min-w-20 shrink cursor-pointer items-center gap-2 rounded-control border border-br3 bg-bg2 px-2.5 font-sans text-13 text-tx5',
              focusRing,
            )}
          >
            <Icon name="search" />
            <span className="truncate">{searchPlaceholder}</span>
            <kbd className="ml-auto shrink-0 font-mono text-11 font-medium text-tx6">/</kbd>
          </button>
        )}
        {onAsk && <AiAskButton shortcut="⌘K" onClick={onAsk} />}
        {onInbox && (
          <IconButton
            label="Inbox"
            icon="inbox"
            {...(inboxCount ? { badge: inboxCount } : {})}
            onClick={onInbox}
          />
        )}
        {onHelp && <IconButton label="Help" icon="help" onClick={onHelp} />}
        {onSettings && <IconButton label="Settings" icon="settings" onClick={onSettings} />}
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

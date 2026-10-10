import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { EntityTile } from '../entity-tile/entity-tile.tsx';
import { Menu, type MenuTriggerProps } from '../menu/menu.tsx';
import { Tooltip } from '../tooltip/tooltip.tsx';
import { Logo } from './logo.tsx';

/** A customer's uploaded logo and name, which take line one of the block (ADR 0015). */
export interface CustomerLogo {
  src: string;
  name: string;
}

export interface BrandBlockProps {
  /** The install's one workspace, under the lockup. */
  workspaceName: string;
  /** With an uploaded logo, line one is theirs and line two reads "on Bemmoly". */
  customLogo?: CustomerLogo | null;
  /** Opens the workspace menu (settings, invite, what's new, about); never a switcher. */
  onWorkspaceMenu?: () => void;
  /** The workspace menu's items: the line under the lockup (or the logo's name) opens them. */
  workspaceMenu?: ReactNode;
  /** The sidebar's collapse button, drawn at the right of the block. */
  sidebarToggle?: ReactNode;
  className?: string;
}

const LINE_BUTTON = cx(
  'flex min-w-0 cursor-pointer items-center gap-1 rounded-chip border-0 bg-transparent p-0 font-sans text-12 text-tx-3 hover:text-tx-2 aria-expanded:text-tx-2',
  focusRing,
);

/** The workspace line: the name and a chevron that opens the workspace menu. */
function WorkspaceLine({
  name,
  onOpen,
  trigger,
}: {
  name: string;
  onOpen?: () => void;
  trigger?: MenuTriggerProps;
}) {
  const body = (
    <>
      <span className="truncate">{name}</span>
      <Icon name="caret" size={11} />
    </>
  );
  if (!onOpen && !trigger) return <span className="flex min-w-0 items-center gap-1">{body}</span>;
  return (
    <button
      type="button"
      {...trigger}
      onClick={trigger?.onClick ?? onOpen}
      aria-haspopup="menu"
      aria-label={`${name}, workspace menu`}
      className={LINE_BUTTON}
    >
      {body}
    </button>
  );
}

/**
 * The top-left of the sidebar on every screen: Bemmoly's mark and wordmark on line one and the
 * workspace on line two, whose chevron opens the workspace menu. With a customer logo their
 * logo and name lead and Bemmoly moves to "on Bemmoly", which cannot be switched off
 * (docs/design/premium/brand.js, `brandBlock`).
 */
export function BrandBlock({
  workspaceName,
  customLogo,
  onWorkspaceMenu,
  workspaceMenu,
  sidebarToggle,
  className,
}: BrandBlockProps) {
  const line = (trigger?: MenuTriggerProps) => (
    <WorkspaceLine
      name={workspaceName}
      {...(onWorkspaceMenu ? { onOpen: onWorkspaceMenu } : {})}
      {...(trigger ? { trigger } : {})}
    />
  );
  return (
    <div className={cx('flex items-center gap-2.5 pt-1 pr-1.5 pb-2.5 pl-2', className)}>
      {customLogo ? (
        <EntityTile name={customLogo.name} src={customLogo.src} size={26} />
      ) : (
        <Logo size={24} label="" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {customLogo && workspaceMenu ? (
          <Menu
            widthClassName="w-60"
            trigger={(props) => (
              <button
                type="button"
                {...props}
                aria-label={`${customLogo.name}, workspace menu`}
                className={cx(
                  LINE_BUTTON,
                  'text-14 leading-tight font-semibold tracking-title text-tx',
                )}
              >
                <span className="truncate">{customLogo.name}</span>
                <Icon name="caret" size={11} className="text-tx-3" />
              </button>
            )}
          >
            {workspaceMenu}
          </Menu>
        ) : customLogo ? (
          <span className="truncate text-14 leading-tight font-semibold tracking-title text-tx">
            {customLogo.name}
          </span>
        ) : (
          <Logo variant="wordmark" trim size={15} />
        )}
        <span className="flex min-w-0 items-center gap-1 text-12 text-tx-3">
          {customLogo ? (
            <>
              on <Logo size={11} label="" />
              <b className="font-semibold text-tx-2">Bemmoly</b>
            </>
          ) : workspaceMenu ? (
            <Menu widthClassName="w-60" trigger={(props) => line(props)}>
              {workspaceMenu}
            </Menu>
          ) : (
            line()
          )}
        </span>
      </div>
      {sidebarToggle}
    </div>
  );
}

export interface BrandRailProps {
  customLogo?: CustomerLogo | null;
  /** The running version, shown with What's new on the mark at the foot of the rail. */
  version?: string;
  onWhatsNew?: () => void;
}

/** The top of the collapsed 56px rail: the Bemmoly mark, or the customer's logo. */
export function BrandRailTop({ customLogo }: Pick<BrandRailProps, 'customLogo'>) {
  return customLogo ? (
    <EntityTile name={customLogo.name} src={customLogo.src} size={28} decorative={false} />
  ) : (
    <Logo size={26} />
  );
}

/**
 * The foot of the collapsed rail under a customer logo: the Bemmoly mark in full colour, whose
 * tooltip gives the version and opens What's new. Without a customer logo the mark already
 * leads the rail, so nothing is drawn here.
 */
export function BrandRailFoot({ customLogo, version, onWhatsNew }: BrandRailProps) {
  if (!customLogo) return null;
  const label = version ? `Bemmoly ${version} · What's new` : "Bemmoly · What's new";
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onWhatsNew}
        className={cx(
          'grid h-7.5 w-9 cursor-pointer place-items-center rounded-control border-0 bg-transparent p-0 hover:bg-hover',
          focusRing,
        )}
      >
        <Logo size={18} label="" />
      </button>
    </Tooltip>
  );
}

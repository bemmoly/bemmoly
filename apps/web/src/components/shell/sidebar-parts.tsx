import { RAIL_BUTTON, useFrame } from '@bemmoly/core-web';
import {
  Avatar,
  BrandBlock,
  BrandRailTop,
  IconButton,
  Kbd,
  Menu,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  Tooltip,
  type MenuTriggerProps,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { useDevMailbox } from '../../hooks/use-dev-mailbox.ts';
import { APP_VERSION, WHATS_NEW_URL, type Shell } from '../../hooks/use-shell.ts';
import { useUiStore } from '../../store/ui.ts';
import { NewButton } from './new-button.tsx';

function openWhatsNew() {
  window.open(WHATS_NEW_URL, '_blank', 'noopener');
}

/** Settings, invite people, what's new and about: the workspace's menu, never a switcher. */
function WorkspaceMenuItems({ shell }: { shell: Shell }) {
  const setAboutOpen = useUiStore((state) => state.setAboutOpen);
  return (
    <>
      <MenuItem icon={<Icon name="settings" />} onSelect={() => shell.go('/settings/workspace')}>
        Workspace settings
      </MenuItem>
      {shell.canInvite ? (
        <MenuItem icon={<Icon name="people" />} onSelect={shell.invite}>
          Invite people
        </MenuItem>
      ) : null}
      <MenuSeparator />
      <MenuItem icon={<Icon name="spark" />} onSelect={openWhatsNew}>
        What’s new
      </MenuItem>
      <MenuItem icon={<Icon name="info" />} onSelect={() => setAboutOpen(true)}>
        About Bemmoly
      </MenuItem>
    </>
  );
}

function CollapseButton({ label }: { label: string }) {
  const { toggleSidebar, mode } = useFrame();
  return (
    <Tooltip label={label} keys="[" side={mode === 'rail' ? 'right' : 'bottom'}>
      <button
        type="button"
        aria-label={label}
        onClick={toggleSidebar}
        className="grid size-6.5 shrink-0 cursor-pointer place-items-center rounded-sm border-0 bg-transparent p-0 text-tx-3 hover:bg-hover hover:text-tx focus-ring"
      >
        <Icon name="sidebar" size={16} />
      </button>
    </Tooltip>
  );
}

/** The top of the sidebar: the brand block, then Search and New. */
export function SidebarTop({ shell }: { shell: Shell }) {
  const { mode, toggleSidebar } = useFrame();
  // In the phone's sheet, [ and this button both close it.
  const closeSheet = toggleSidebar;
  if (mode === 'rail') {
    return (
      <div className="flex flex-col items-center gap-1">
        <Tooltip label="Expand sidebar" keys="[" side="right">
          <button
            type="button"
            aria-label="Expand sidebar"
            onClick={toggleSidebar}
            className="mb-2.5 grid cursor-pointer place-items-center rounded-card border-0 bg-transparent p-1 hover:bg-hover focus-ring"
          >
            <BrandRailTop customLogo={shell.customLogo} />
          </button>
        </Tooltip>
        <Tooltip label="Search" keys="Mod+K" side="right">
          <button type="button" aria-label="Search" onClick={shell.search} className={RAIL_BUTTON}>
            <Icon name="search" size={17} />
          </button>
        </Tooltip>
        <span className="mt-0.5 mb-2">
          <NewButton shell={shell} />
        </span>
      </div>
    );
  }
  return (
    <>
      <BrandBlock
        workspaceName={shell.workspace.name}
        customLogo={shell.customLogo}
        workspaceMenu={<WorkspaceMenuItems shell={shell} />}
        sidebarToggle={
          mode === 'sheet' ? (
            <IconButton label="Close menu" icon="close" size="xs" onClick={closeSheet} />
          ) : (
            <CollapseButton label="Collapse sidebar" />
          )
        }
      />
      <div className="flex gap-1.5 px-0.5 pt-1.5 pb-2.5">
        <button
          type="button"
          onClick={shell.search}
          className="flex h-7.5 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control border-0 bg-card px-2 text-left font-sans text-13 text-tx-3 shadow-e1 hover:text-tx-2 focus-ring"
        >
          <Icon name="search" size={15} />
          <span className="flex-1">Search</span>
          <Kbd keys="Mod+K" />
        </button>
        <NewButton shell={shell} />
      </div>
    </>
  );
}

/** The person: their row (or the rail's avatar) opens Profile, Theme and Sign out. */
export function UserMenu({ shell }: { shell: Shell }) {
  const { mode } = useFrame();
  const name = shell.me.user.name;
  const devMailbox = useDevMailbox(shell.me.can('workspace.email.manage'));
  const trigger =
    mode === 'rail'
      ? (props: MenuTriggerProps) => (
          <button
            type="button"
            {...props}
            aria-label={`Account: ${name}`}
            className="grid cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 focus-ring"
          >
            <Avatar name={name} hue="accent" size={26} />
          </button>
        )
      : (props: MenuTriggerProps) => (
          <button
            type="button"
            {...props}
            aria-label={`Account: ${name}`}
            className="flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-control border-0 bg-transparent px-2 text-left font-sans text-13 text-tx hover:bg-hover focus-ring-inset aria-expanded:bg-hover"
          >
            <Avatar name={name} hue="accent" size={22} />
            <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
            <Icon name="caret-up" size={14} className="text-tx-3" />
          </button>
        );
  return (
    <Menu align="start" widthClassName="w-60" trigger={trigger}>
      <div className="flex flex-col gap-0.5 border-b border-line px-2.5 pt-1 pb-2">
        <span className="font-medium text-tx">{name}</span>
        <span className="truncate text-12 text-tx-3">{shell.me.user.email}</span>
      </div>
      <div className="h-1" />
      <MenuItem icon={<Icon name="me" />} onSelect={() => shell.go('/settings/profile')}>
        Profile
      </MenuItem>
      <MenuItem icon={<Icon name="bell" />} onSelect={() => shell.go('/settings/notifications')}>
        Notification preferences
      </MenuItem>
      {devMailbox.enabled ? (
        <MenuItem icon={<Icon name="mail" />} onSelect={() => shell.go('/dev/mailbox')}>
          Dev mailbox
        </MenuItem>
      ) : null}
      {shell.themes.length > 0 ? (
        <MenuGroup label="Theme" separated>
          {shell.themes.map((choice) => (
            <MenuItem key={choice.id} checked={choice.checked} onSelect={choice.onSelect}>
              {choice.label}
            </MenuItem>
          ))}
          {shell.canManageAppearance ? (
            <MenuItem onSelect={() => shell.go('/settings/appearance')}>
              Workspace appearance…
            </MenuItem>
          ) : null}
        </MenuGroup>
      ) : null}
      <MenuSeparator />
      <MenuItem icon={<Icon name="arrow-left" />} onSelect={shell.signOut}>
        Sign out
      </MenuItem>
    </Menu>
  );
}

/** "Bemmoly 0.3.0 · What's new" on every screen, under the footer rows. */
export function VersionLine() {
  return (
    <a
      href={WHATS_NEW_URL}
      target="_blank"
      rel="noopener"
      className="mx-2 mt-1 mb-0.5 flex items-center gap-1.5 rounded-sm text-11 text-tx-3 no-underline hover:text-tx-2 focus-ring"
    >
      <span>
        <b className="font-semibold text-tx-2">Bemmoly</b> {APP_VERSION}
      </span>
      <span aria-hidden>·</span>
      <span className="text-acc">What’s new</span>
    </a>
  );
}

/** The footer: a rule, then its rows, pinned to the bottom of the sidebar. */
export function SidebarFoot({ children }: { children: ReactNode }) {
  const { mode } = useFrame();
  return (
    <div
      className={
        mode === 'rail'
          ? 'mt-auto flex flex-col items-center gap-1.5 pt-2'
          : 'mt-auto flex flex-col gap-0.5 border-t border-line pt-2'
      }
    >
      {children}
    </div>
  );
}

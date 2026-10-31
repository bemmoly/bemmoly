import {
  productAt,
  ProductSwitcher,
  RAIL_BUTTON,
  START_PATH,
  useFrame,
  useT,
} from '@bemmoly/core-web';
import {
  Avatar,
  BrandBlock,
  BrandRailTop,
  IconButton,
  Kbd,
  Menu,
  MenuItem,
  MenuSeparator,
  Tooltip,
  type MenuTriggerProps,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { useDevMailbox } from '../../hooks/use-dev-mailbox.ts';
import { APP_VERSION, WHATS_NEW_URL, type Shell } from '../../hooks/use-shell.ts';
import { shellText } from '../../i18n/catalogs.ts';
import { useUiStore } from '../../store/ui.ts';
import { AppearanceMenu } from './appearance-menu.tsx';
import { NewButton } from './new-button.tsx';

function openWhatsNew() {
  window.open(WHATS_NEW_URL, '_blank', 'noopener');
}

/** Settings, invite people, what's new and about: the workspace's menu, never a switcher. */
function WorkspaceMenuItems({ shell }: { shell: Shell }) {
  const t = useT(shellText);
  const setAboutOpen = useUiStore((state) => state.setAboutOpen);
  return (
    <>
      <MenuItem icon={<Icon name="settings" />} onSelect={() => shell.go('/settings/workspace')}>
        {t('shell.workspace.settings')}
      </MenuItem>
      {shell.canInvite ? (
        <MenuItem icon={<Icon name="people" />} onSelect={shell.invite}>
          {t('shell.workspace.invite')}
        </MenuItem>
      ) : null}
      <MenuSeparator />
      <MenuItem icon={<Icon name="spark" />} onSelect={openWhatsNew}>
        {t('shell.version.whatsNew')}
      </MenuItem>
      <MenuItem icon={<Icon name="info" />} onSelect={() => setAboutOpen(true)}>
        {t('shell.workspace.about')}
      </MenuItem>
    </>
  );
}

/** The grid button: back to the start page, or across to another product. */
function Products({ shell, rail }: { shell: Shell; rail: boolean }) {
  const { pathname } = useFrame();
  return (
    <ProductSwitcher
      products={shell.products}
      currentId={productAt(shell.products, pathname)?.id}
      onOpen={shell.openProduct}
      startPath={START_PATH}
      side={rail ? 'right' : 'bottom'}
      className={
        rail
          ? RAIL_BUTTON
          : 'grid size-7.5 shrink-0 cursor-pointer place-items-center rounded-control border-0 bg-card p-0 text-tx-2 shadow-e1 hover:text-tx focus-ring aria-expanded:text-tx'
      }
    />
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
        className="grid size-6.5 shrink-0 cursor-pointer place-items-center rounded-chip border-0 bg-transparent p-0 text-tx-3 hover:bg-hover hover:text-tx focus-ring"
      >
        <Icon name="sidebar" size={16} />
      </button>
    </Tooltip>
  );
}

/** The top of the sidebar: the brand block, then Search and New. */
export function SidebarTop({ shell }: { shell: Shell }) {
  const t = useT(shellText);
  const { mode, toggleSidebar } = useFrame();
  // In the phone's sheet, [ and this button both close it.
  const closeSheet = toggleSidebar;
  if (mode === 'rail') {
    return (
      <div className="flex flex-col items-center gap-1">
        <Tooltip label={t('shell.sidebar.expand')} keys="[" side="right">
          <button
            type="button"
            aria-label={t('shell.sidebar.expand')}
            onClick={toggleSidebar}
            className="mb-2.5 grid cursor-pointer place-items-center rounded-card border-0 bg-transparent p-1 hover:bg-hover focus-ring"
          >
            <BrandRailTop customLogo={shell.customLogo} />
          </button>
        </Tooltip>
        <Tooltip label={t('shell.sidebar.search')} keys="Mod+K" side="right">
          <button
            type="button"
            aria-label={t('shell.sidebar.search')}
            onClick={shell.search}
            className={RAIL_BUTTON}
          >
            <Icon name="search" size={17} />
          </button>
        </Tooltip>
        <Products shell={shell} rail />
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
        onHome={() => shell.go('/')}
        sidebarToggle={
          mode === 'sheet' ? (
            <IconButton
              label={t('shell.sidebar.closeMenu')}
              icon="close"
              size="xs"
              onClick={closeSheet}
            />
          ) : (
            <CollapseButton label={t('shell.sidebar.collapse')} />
          )
        }
      />
      <div className="flex gap-1.5 px-0.5 pt-1.5 pb-2.5">
        <button
          type="button"
          onClick={shell.search}
          className="flex h-7.5 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control border-0 bg-card px-2 text-start font-sans text-13 text-tx-3 shadow-e1 hover:text-tx-2 focus-ring"
        >
          <Icon name="search" size={15} />
          <span className="flex-1">{t('shell.sidebar.search')}</span>
          <Kbd keys="Mod+K" />
        </button>
        <Products shell={shell} rail={false} />
        <NewButton shell={shell} />
      </div>
    </>
  );
}

/** The person: their row (or the rail's avatar) opens Profile, notifications and Sign out. */
export function UserMenu({ shell }: { shell: Shell }) {
  const { mode } = useFrame();
  const t = useT(shellText);
  const name = shell.me.user.name;
  const devMailbox = useDevMailbox(shell.me.can('workspace.email.manage'));
  const trigger =
    mode === 'rail'
      ? (props: MenuTriggerProps) => (
          <button
            type="button"
            {...props}
            aria-label={t('shell.account.label', { name })}
            className="grid cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 focus-ring"
          >
            <Avatar name={name} hue="accent" size={26} />
          </button>
        )
      : (props: MenuTriggerProps) => (
          <button
            type="button"
            {...props}
            aria-label={t('shell.account.label', { name })}
            className="flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-control border-0 bg-transparent px-2 text-start font-sans text-13 text-tx hover:bg-hover focus-ring-inset aria-expanded:bg-hover"
          >
            <Avatar name={name} hue="accent" size={22} />
            <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
            <Icon name="caret-up" size={14} className="text-tx-3" />
          </button>
        );
  return (
    <Menu align="start" widthClassName="w-65" trigger={trigger}>
      <div className="flex flex-col gap-0.5 border-b border-line px-2.5 pt-1 pb-2">
        <span className="font-medium text-tx">{name}</span>
        <span className="truncate text-12 text-tx-3">{shell.me.user.email}</span>
      </div>
      <div className="h-1" />
      <MenuItem icon={<Icon name="me" />} onSelect={() => shell.go('/settings/profile')}>
        {t('shell.account.profile')}
      </MenuItem>
      <MenuItem icon={<Icon name="bell" />} onSelect={() => shell.go('/settings/notifications')}>
        {t('shell.account.notifications')}
      </MenuItem>
      {devMailbox.enabled ? (
        <MenuItem icon={<Icon name="mail" />} onSelect={() => shell.go('/dev/mailbox')}>
          {t('shell.account.devMailbox')}
        </MenuItem>
      ) : null}
      <MenuSeparator />
      <MenuItem icon={<Icon name="arrow-left" />} onSelect={shell.signOut}>
        {t('shell.account.signOut')}
      </MenuItem>
    </Menu>
  );
}

/** "Bemmoly 0.3.0 · What's new" on every screen, under the footer rows. */
export function VersionLine() {
  const t = useT(shellText);
  return (
    <a
      href={WHATS_NEW_URL}
      target="_blank"
      rel="noopener"
      className="mx-2 mt-1 mb-0.5 flex items-center gap-1.5 rounded-chip text-11 text-tx-3 no-underline hover:text-tx-2 focus-ring"
    >
      <span>
        <b className="font-semibold text-tx-2">Bemmoly</b> {APP_VERSION}
      </span>
      <span aria-hidden>·</span>
      <span className="text-acc">{t('shell.version.whatsNew')}</span>
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

/**
 * The footer's last row: the person's menu with the Appearance button on its right, or on the
 * rail the avatar with the button stacked above it.
 */
export function AccountRow({ shell }: { shell: Shell }) {
  const rail = useFrame().mode === 'rail';
  return (
    <div
      className={rail ? 'flex flex-col-reverse items-center gap-1.5' : 'flex items-center gap-1'}
    >
      <div className={rail ? 'contents' : 'min-w-0 flex-1'}>
        <UserMenu shell={shell} />
      </div>
      <AppearanceMenu shell={shell} />
    </div>
  );
}

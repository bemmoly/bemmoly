import { knownIcon, SidebarRow, useFrame, useSidebarFocusOwner, useT } from '@bemmoly/core-web';
import { BrandRailFoot } from '@bemmoly/ui';
import { useEffect } from 'react';
import { APP_VERSION, WHATS_NEW_URL, type Shell } from '../../hooks/use-shell.ts';
import { shellText } from '../../i18n/catalogs.ts';
import { MODULE_SIDEBARS } from '../../lib/module-shell.ts';
import { useUiStore } from '../../store/ui.ts';
import { ModuleSection } from './module-section.tsx';
import { SidebarFoot, SidebarTop, AccountRow, VersionLine } from './sidebar-parts.tsx';

/**
 * The app sidebar (docs/design/premium/kit.js, `sidebar`): the brand block, Search and New,
 * Home, Inbox and what modules add beside them (My issues), each module's section, then
 * Settings, Help and shortcuts, the version line and the person. The same component draws the
 * 56px rail and the phone's sheet; only the frame's mode differs. Under a customer logo the rail
 * keeps the Bemmoly mark at its foot, with the version and What's new.
 */
export function AppSidebar({ shell }: { shell: Shell }) {
  const t = useT(shellText);
  const { mode } = useFrame();
  const rail = mode === 'rail';
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen);
  const { modules } = shell;
  // A section in focus mode (a big Docs space) has the sidebar to itself; never on the rail.
  const focusOwner = useSidebarFocusOwner();
  const focused = rail ? undefined : modules.find((manifest) => manifest.id === focusOwner);

  useEffect(() => {
    MODULE_SIDEBARS.preload(modules);
  }, [modules]);

  return (
    <>
      <SidebarTop shell={shell} />
      <nav
        aria-label={t('shell.nav.main')}
        hidden={Boolean(focused)}
        className={`flex flex-col gap-0.5 ${rail ? 'items-center' : ''}`}
      >
        <SidebarRow
          label={t('shell.nav.home')}
          icon="home"
          path="/"
          exact
          keys="G H"
          testId="nav-home"
        />
        <SidebarRow
          label={t('shell.nav.inbox')}
          icon="inbox"
          path="/inbox"
          keys="G I"
          testId="nav-inbox"
          {...(shell.unreadCount > 0 ? { pill: shell.unreadCount } : {})}
        />
        {shell.primary.map((link) => (
          <SidebarRow
            key={link.id}
            label={link.label}
            icon={knownIcon(link.icon) ?? 'me'}
            path={link.path}
          />
        ))}
      </nav>
      {rail || focused ? null : (
        <hr aria-hidden className="mx-2 my-2.5 border-0 border-t border-line" />
      )}
      <div
        className={`-mx-2 flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2 ${rail ? 'mx-0 items-center gap-0.5 px-0' : 'gap-2.5'}`}
      >
        {modules.map((manifest) =>
          focused && manifest !== focused ? null : (
            <ModuleSection key={manifest.id} manifest={manifest} alone={manifest === focused} />
          ),
        )}
      </div>
      <SidebarFoot>
        <SidebarRow
          label={t('shell.nav.settings')}
          icon="settings"
          path="/settings"
          testId="nav-settings"
        />
        <SidebarRow
          label={t('shell.nav.help')}
          icon="help"
          keys="?"
          onSelect={() => setShortcutsOpen(true)}
        />
        {rail ? (
          <BrandRailFoot
            customLogo={shell.customLogo}
            version={APP_VERSION}
            onWhatsNew={() => window.open(WHATS_NEW_URL, '_blank', 'noopener')}
          />
        ) : (
          <VersionLine />
        )}
        <div className="mt-1">
          <AccountRow shell={shell} />
        </div>
      </SidebarFoot>
    </>
  );
}

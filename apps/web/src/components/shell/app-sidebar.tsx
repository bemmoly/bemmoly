import { knownIcon, SidebarRow, useFrame } from '@bemmoly/core-web';
import { useEffect } from 'react';
import type { Shell } from '../../hooks/use-shell.ts';
import { MODULE_SIDEBARS } from '../../lib/module-shell.ts';
import { useUiStore } from '../../store/ui.ts';
import { ModuleSection } from './module-section.tsx';
import { SidebarFoot, SidebarTop, UserMenu, VersionLine } from './sidebar-parts.tsx';

/**
 * The app sidebar (docs/design/premium/kit.js, `sidebar`): the brand block, Search and New,
 * Home, Inbox and what modules add beside them (My issues), each module's section, then
 * Settings, Help and shortcuts, the version line and the person. The same component draws the
 * 56px rail and the phone's sheet; only the frame's mode differs.
 */
export function AppSidebar({ shell }: { shell: Shell }) {
  const { mode } = useFrame();
  const rail = mode === 'rail';
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen);
  const { modules } = shell;

  useEffect(() => {
    MODULE_SIDEBARS.preload(modules);
  }, [modules]);

  return (
    <>
      <SidebarTop shell={shell} />
      <nav aria-label="Main" className={`flex flex-col gap-0.5 ${rail ? 'items-center' : ''}`}>
        <SidebarRow label="Home" icon="home" path="/" exact keys="G H" testId="nav-home" />
        <SidebarRow
          label="Inbox"
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
      <div
        className={`-mx-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2 ${rail ? 'mx-0 items-center px-0' : ''}`}
      >
        {modules.map((manifest) => (
          <ModuleSection key={manifest.id} manifest={manifest} />
        ))}
      </div>
      <SidebarFoot>
        <SidebarRow label="Settings" icon="settings" path="/settings" testId="nav-settings" />
        <SidebarRow
          label="Help and shortcuts"
          icon="help"
          keys="?"
          onSelect={() => setShortcutsOpen(true)}
        />
        {rail ? null : <VersionLine />}
        <div className={rail ? 'mt-1' : 'mt-1'}>
          <UserMenu shell={shell} />
        </div>
      </SidebarFoot>
    </>
  );
}

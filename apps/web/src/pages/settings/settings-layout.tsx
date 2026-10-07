import { buildSettingsNav } from '@bemmoly/core-web';
import { SettingsFrame, SettingsNav, SettingsNavItem, SettingsNavSection } from '@bemmoly/ui';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useDirectory } from '../../hooks/use-directory.ts';
import { useModules } from '../../hooks/use-modules.ts';
import { useMe } from '../../hooks/use-session.ts';
import { viewerOf } from '../../lib/session.ts';

/** The settings frame from the People and Appearance mocks around every settings page. */
export function SettingsLayout() {
  const me = useMe();
  const { data: modules = [] } = useModules();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const people = me.can('workspace.roles.manage');
  const { directory, isSuccess } = useDirectory(people);
  const groups = buildSettingsNav(
    modules,
    viewerOf(me),
    people && isSuccess ? { users: directory.counts.active } : {},
  );
  const nav = (
    <SettingsNav title={me.isAdmin ? 'Workspace settings' : 'Settings'} label="Settings">
      {groups.map((group) => (
        <SettingsNavSection key={group.id} label={group.label}>
          {group.items.map((item) => (
            <SettingsNavItem
              key={item.id}
              href={item.path}
              linkAs={Link}
              linkProps={{ to: item.path }}
              active={pathname === item.path || pathname.startsWith(`${item.path}/`)}
              {...(item.count === undefined ? {} : { count: item.count })}
            >
              {item.label}
            </SettingsNavItem>
          ))}
        </SettingsNavSection>
      ))}
    </SettingsNav>
  );
  return (
    <SettingsFrame nav={nav}>
      <Outlet />
    </SettingsFrame>
  );
}

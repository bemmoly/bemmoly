import { buildSettingsNav, SettingsFrame } from '@bemmoly/core-web';
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
  return (
    <SettingsFrame
      title={me.isAdmin ? 'Workspace settings' : 'Settings'}
      groups={groups}
      activePath={pathname}
      renderLink={({ item, className, children, active }) => (
        <Link to={item.path} className={className} aria-current={active ? 'page' : undefined}>
          {children}
        </Link>
      )}
    >
      <Outlet />
    </SettingsFrame>
  );
}

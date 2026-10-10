import { PageLayout, settingsTrail, type PageCrumb } from '@bemmoly/core-web';
import { Icon } from '@bemmoly/ui/icons';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { useSettingsGroups } from '../../components/shell/settings-sidebar.tsx';
import { useShell } from '../../hooks/use-shell.ts';

/**
 * Settings pages in the frame's content area: the sidebar shows the settings contents, the
 * header the trail "Settings / People / Teams", and each page its own blocks in the reading
 * column.
 */
export function SettingsLayout() {
  const shell = useShell();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const groups = useSettingsGroups(shell);
  const trail = settingsTrail(groups, pathname);
  const crumbs: PageCrumb[] = [
    { label: 'Settings', path: '/settings', icon: <Icon name="settings" size={15} /> },
    ...(trail
      ? [
          { label: trail.group.label, path: trail.group.items[0]?.path ?? trail.item.path },
          { label: trail.item.label, path: trail.item.path },
        ]
      : []),
  ];
  return (
    <PageLayout
      layout="contained"
      header={{ crumbs }}
      title={trail ? [trail.item.label, 'Settings'] : ['Settings']}
    >
      <Outlet />
    </PageLayout>
  );
}

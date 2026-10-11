import { PageLayout, settingsTrail, type PageCrumb, type PageTab } from '@bemmoly/core-web';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { useSettingsGroups } from '../../components/shell/settings-sidebar.tsx';
import { aiSettingsQuery, CONFIGURE_AI } from '../../hooks/use-ai-admin.ts';
import { useMe } from '../../hooks/use-session.ts';
import { useShell } from '../../hooks/use-shell.ts';

const AI_PATH = '/settings/ai';

/** Settings › AI's sections, as the header's tabs (a settings area's sections, layout.md). */
export const AI_TABS: readonly PageTab[] = [
  { id: 'ai-setup', label: 'Setup', icon: 'sliders', path: AI_PATH },
  { id: 'ai-privacy', label: 'Privacy', icon: 'shield', path: `${AI_PATH}/privacy` },
  { id: 'ai-usage', label: 'Usage', icon: 'reports', path: `${AI_PATH}/usage` },
  { id: 'ai-prompts', label: 'Prompts', icon: 'message', path: `${AI_PATH}/prompts` },
];

/**
 * The AI area's tabs, only while AI is on: turned off, the page is the one switch (and the
 * providers it keeps), so its sections fold away with every other AI surface.
 */
function useAreaTabs(pathname: string): { tabs?: readonly PageTab[]; activeTab?: string } {
  const me = useMe();
  const inAi = pathname === AI_PATH || pathname.startsWith(`${AI_PATH}/`);
  const settings = useQuery({ ...aiSettingsQuery, enabled: inAi && me.can(CONFIGURE_AI) });
  if (!inAi || !settings.data?.privacy.enabled) return {};
  const active =
    AI_TABS.find((tab) => tab.path !== AI_PATH && pathname.startsWith(tab.path)) ?? AI_TABS[0];
  return { tabs: AI_TABS, ...(active ? { activeTab: active.id } : {}) };
}

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
  const area = useAreaTabs(pathname);
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
      header={{ crumbs, ...area }}
      title={trail ? [trail.item.label, 'Settings'] : ['Settings']}
    >
      <Outlet />
    </PageLayout>
  );
}

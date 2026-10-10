import { ModuleTile, type PageCrumb, type PageHeaderProps, type PageTab } from '@bemmoly/core-web';
import type { ModuleManifest } from '@bemmoly/shared';
import type { Project } from '@bemmoly/module-work/shared';
import { Icon } from '@bemmoly/ui/icons';
import { workPaths } from '../hooks/issue-navigation.ts';
import { isSettingsPage, settingsPath } from '../settings/pages.ts';
import { ProjectTile } from '../shared/project-tile.tsx';
import { useProject } from '../shared/use-project.ts';
import { workflowPaths } from '../workflow/navigate.ts';

/** The screens that belong to one project, and how the project switcher keeps you on them. */
const PROJECT_SCREENS = ['board', 'backlog', 'issue', 'members', 'settings', 'workflows'] as const;
type ProjectScreen = (typeof PROJECT_SCREENS)[number];

const isProjectScreen = (name: string): name is ProjectScreen =>
  (PROJECT_SCREENS as readonly string[]).includes(name);

/** Board and Backlog: two views of the same project, as header tabs with their chords. */
export const viewTabs = (key: string): PageTab[] => [
  { id: 'board', label: 'Board', icon: 'board', path: workPaths.board(key), keys: 'G B' },
  { id: 'backlog', label: 'Backlog', icon: 'backlog', path: workPaths.backlog(key), keys: 'G L' },
];

/** A project's settings sections, as header tabs; Members moved in from its own page. */
export const settingsTabs = (key: string): PageTab[] => [
  { id: 'members', label: 'Members', icon: 'people', path: `/work/members/${key}` },
  {
    id: 'issue-types',
    label: 'Issue types',
    icon: 'layers',
    path: settingsPath(key, 'issue-types'),
  },
  { id: 'fields', label: 'Fields', icon: 'list', path: settingsPath(key, 'fields') },
  { id: 'workflow', label: 'Workflow', icon: 'workflow', path: workflowPaths.list(key) },
  { id: 'board', label: 'Board', icon: 'board', path: settingsPath(key, 'board') },
];

/** Where the switcher sends you in another project: the same screen, or its board. */
function samePlace(screen: ProjectScreen, rest: readonly string[], key: string): string {
  if (screen === 'backlog') return workPaths.backlog(key);
  if (screen === 'members') return `/work/members/${key}`;
  if (screen === 'workflows') return workflowPaths.list(key);
  if (screen === 'settings') return settingsPath(key, isSettingsPage(rest[0]) ? rest[0] : 'board');
  return workPaths.board(key);
}

function projectCrumb(
  project: Project | undefined,
  fallbackKey: string,
  projects: readonly Project[],
  target: (key: string) => string,
): PageCrumb {
  const key = project?.key ?? fallbackKey;
  return {
    label: project?.name ?? key,
    path: target(key),
    icon: project ? <ProjectTile project={project} size={16} /> : <Icon name="project" size={15} />,
    switcher: {
      placeholder: 'Switch project…',
      currentId: project?.id,
      items: projects.map((item) => ({
        id: item.id,
        label: item.name,
        hint: item.key,
        icon: <ProjectTile project={item} size={16} />,
        path: target(item.key),
      })),
      footer: [
        {
          id: 'all',
          label: 'All projects',
          icon: <Icon name="layers" size={15} />,
          path: workPaths.projects(),
        },
      ],
    },
  };
}

export interface WorkFrame {
  layout: 'full' | 'contained';
  header: PageHeaderProps;
  title?: string[];
}

/**
 * The frame around each Work screen, from its route: the breadcrumbs (the project crumb
 * switches projects and keeps you on the same screen), the view or settings tabs, and the
 * layout. Screens add their own buttons with <HeaderActions>.
 */
export function useWorkFrame(
  manifest: ModuleManifest,
  name: string,
  pathKey: string | undefined,
  rest: readonly string[],
): WorkFrame {
  const issueKey = name === 'issue' ? pathKey?.toUpperCase() : undefined;
  const { project, projects } = useProject(issueKey ? issueKey.split('-')[0] : pathKey);
  const work: PageCrumb = {
    label: manifest.name ?? 'Work',
    path: workPaths.projects(),
    icon: <ModuleTile manifest={manifest} size={16} />,
  };
  if (name === 'my-issues') {
    return {
      layout: 'contained',
      header: {
        crumbs: [
          { label: 'My issues', path: workPaths.myIssues(), icon: <Icon name="me" size={15} /> },
        ],
      },
    };
  }
  if (!isProjectScreen(name)) {
    return {
      layout: 'contained',
      header: { crumbs: [work, { label: 'Projects', path: workPaths.projects() }] },
      title: ['Projects', manifest.name ?? 'Work'],
    };
  }
  const key = project?.key ?? pathKey?.toUpperCase() ?? '';
  const crumb = projectCrumb(project, key, projects, (next) => samePlace(name, rest, next));
  if (name === 'board' || name === 'backlog') {
    return { layout: 'full', header: { crumbs: [crumb], tabs: viewTabs(key), activeTab: name } };
  }
  if (name === 'issue') {
    return {
      layout: 'contained',
      header: { crumbs: [crumb, { label: issueKey ?? '', path: workPaths.issue(issueKey ?? '') }] },
      title: [issueKey ?? '', project?.name ?? ''],
    };
  }
  const activeTab =
    name === 'members'
      ? 'members'
      : name === 'workflows'
        ? 'workflow'
        : isSettingsPage(rest[0])
          ? rest[0]
          : 'board';
  const editing = name === 'workflows' && rest[0];
  return {
    layout: name === 'members' || (name === 'workflows' && !editing) ? 'contained' : 'full',
    header: {
      crumbs: [
        crumb,
        {
          label: 'Settings',
          path: workPaths.settings(key),
          icon: <Icon name="settings" size={15} />,
        },
      ],
      tabs: settingsTabs(key),
      activeTab,
    },
    title: [
      settingsTabs(key).find((tab) => tab.id === activeTab)?.label ?? 'Settings',
      project?.name ?? key,
    ],
  };
}

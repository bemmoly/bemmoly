import { SidebarRow, isActivePath, useFrame, type ModuleSidebarProps } from '@bemmoly/core-web';
import type { Project } from '@bemmoly/module-work/shared';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { workPaths } from './hooks/issue-navigation.ts';
import { settingsPath } from './settings/pages.ts';
import { useProjectStore, useRecentProjects } from './shared/project-store.ts';
import { ProjectTile } from './shared/project-tile.tsx';
import { projectsQuery } from './shared/use-project.ts';
import { workflowPaths } from './workflow/navigate.ts';

/** How many projects the sidebar lists before "All projects" takes over. */
const SHOWN = 5;

/** The project the address is in: /work/board/PLT, /work/issue/PLT-204, its settings. */
function projectInPath(pathname: string): string | null {
  const [, area, screen, segment] = pathname.split('/');
  if (area !== 'work' || !segment) return null;
  if (screen === 'issue') return segment.split('-')[0]?.toUpperCase() ?? null;
  return ['board', 'backlog', 'members', 'settings', 'workflows'].includes(screen ?? '')
    ? segment.toUpperCase()
    : null;
}

/** The current project first, then the ones used recently, then the rest by name. */
export function sidebarProjects(
  projects: readonly Project[],
  current: string | null,
  recent: readonly string[],
): Project[] {
  const rank = (project: Project) => {
    if (project.key === current) return -1;
    const at = recent.indexOf(project.key);
    return at === -1 ? recent.length : at;
  };
  return [...projects]
    .filter((project) => !project.archivedAt)
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .slice(0, SHOWN);
}

/** The current project's views: Board, Backlog and its Settings. */
function ProjectViews({ project, pathname }: { project: Project; pathname: string }) {
  const key = project.key;
  const inSettings = [
    `/work/members/${key}`,
    `/work/settings/${key}`,
    workflowPaths.list(key),
    settingsPath(key, 'board'),
  ].some((path) => isActivePath(pathname, path));
  return (
    <>
      <SidebarRow child label="Board" icon="board" path={workPaths.board(key)} keys="G B" />
      <SidebarRow child label="Backlog" icon="backlog" path={workPaths.backlog(key)} keys="G L" />
      <SidebarRow
        child
        label="Settings"
        icon="settings"
        path={workPaths.settings(key)}
        active={inSettings}
      />
    </>
  );
}

/**
 * Work's live sidebar rows (docs/design/premium/kit.js, `sidebar`): the projects, the one in
 * use opened to its views. On the rail each project is its tile. The heading, its "+" and "All
 * projects" come from the manifest.
 */
export default function WorkSidebar(_props: ModuleSidebarProps) {
  const { mode, pathname } = useFrame();
  const { projectKey } = useProjectStore();
  const recent = useRecentProjects();
  const query = useQuery(projectsQuery);
  const inPath = projectInPath(pathname);
  const current = inPath ?? projectKey;
  const projects = sidebarProjects(query.data?.items ?? [], current, recent);
  const inWork = pathname.startsWith('/work/');

  if (query.isError) {
    return mode === 'rail' ? null : (
      <p className="m-0 px-2 py-1 text-12 text-tx-3">Projects did not load.</p>
    );
  }
  if (query.isSuccess && projects.length === 0) {
    return mode === 'rail' ? null : (
      <p className="m-0 flex items-center gap-1.5 px-2 py-1 text-12 text-tx-3">
        <Icon name="project" size={14} /> No projects yet
      </p>
    );
  }
  return (
    <>
      {projects.map((project) => {
        const open = project.key === current;
        const here = inWork && inPath === project.key;
        return (
          <div key={project.id} className="flex flex-col gap-0.5">
            <SidebarRow
              label={project.name}
              icon={<ProjectTile project={project} size={mode === 'rail' ? 22 : 18} />}
              path={workPaths.board(project.key)}
              active={mode === 'rail' ? here : here && !open}
              end={
                mode === 'rail' || !open ? null : (
                  <Icon name="caret" size={14} className="text-tx-3" />
                )
              }
            />
            {open && mode !== 'rail' ? (
              <ProjectViews project={project} pathname={pathname} />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

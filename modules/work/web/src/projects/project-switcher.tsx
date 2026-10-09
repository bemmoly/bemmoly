import { Select } from '@bemmoly/ui';
import { navigateTo } from '../hooks/issue-navigation.ts';
import { useProject } from '../shared/use-project.ts';

export interface ProjectSwitcherProps {
  /** The screen to stay on: "board" moves /work/board/PLT to /work/board/MOB. */
  screen: string;
  /** The key in the path, if any; the switcher shows the project the screen shows. */
  projectKey: string | undefined;
  className?: string;
}

/**
 * The project picker of the Work screens: the projects the person can see, searchable once
 * the list is long, and a choice moves the current screen to that project's path.
 */
export function ProjectSwitcher({ screen, projectKey, className }: ProjectSwitcherProps) {
  const { projects, project, setProjectKey, isPending } = useProject(projectKey);
  return (
    <Select
      aria-label="Project"
      size="sm"
      disabled={isPending}
      value={project?.key ?? ''}
      placeholder={isPending ? 'Loading projects…' : 'Choose a project'}
      searchable={projects.length > 8}
      options={projects.map((item) => ({
        value: item.key,
        label: item.name,
        description: `${item.key} · ${item.method === 'scrum' ? 'Scrum' : 'Kanban'}`,
      }))}
      onChange={(event) => {
        setProjectKey(event.value);
        navigateTo(`/work/${screen}/${event.value}`);
      }}
      {...(className ? { className } : {})}
    />
  );
}

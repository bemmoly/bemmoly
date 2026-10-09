import { Select } from '@bemmoly/ui';
import { navigateTo } from '../hooks/issue-navigation.ts';
import { useProject } from '../shared/use-project.ts';
import { membersPath } from './members-hooks.ts';

/** Option values that open a screen of the current project rather than switch projects. */
const MEMBERS = 'members:';

export interface ProjectSwitcherProps {
  /** The screen to stay on: "board" moves /work/board/PLT to /work/board/MOB. */
  screen: string;
  /** The key in the path, if any; the switcher shows the project the screen shows. */
  projectKey: string | undefined;
  className?: string;
}

/**
 * The project picker of the Work screens: the projects the person can see, searchable once
 * the list is long, and a choice moves the current screen to that project's path. Below them,
 * the current project's members screen.
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
      groups={[
        {
          label: 'Projects',
          options: projects.map((item) => ({
            value: item.key,
            label: item.name,
            description: `${item.key} · ${item.method === 'scrum' ? 'Scrum' : 'Kanban'}`,
          })),
        },
        ...(project
          ? [
              {
                label: project.name,
                options: [
                  {
                    value: `${MEMBERS}${project.key}`,
                    label: 'Members',
                    description: 'Who is on the project, and their roles',
                  },
                ],
              },
            ]
          : []),
      ]}
      onChange={(event) => {
        if (event.value.startsWith(MEMBERS)) {
          navigateTo(membersPath(event.value.slice(MEMBERS.length)));
          return;
        }
        setProjectKey(event.value);
        navigateTo(`/work/${screen}/${event.value}`);
      }}
      {...(className ? { className } : {})}
    />
  );
}

import type { Project } from '@bemmoly/module-work/shared';
import { SettingsNav, SettingsNavItem, SettingsNavSection } from '@bemmoly/ui';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

/**
 * The project sidebar of the Backlog mock: the project tile and name over
 * the Planning links. Only screens that exist are listed; the rest of the
 * mock's links arrive with their screens.
 */
export function ProjectNav({ project }: { project: Project | undefined }) {
  const key = project?.key ?? '';
  return (
    <SettingsNav
      label="Project"
      title={
        <div className="flex items-center gap-2.5 px-2 pt-0 pb-1">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-ac-fill font-semibold text-on-ac"
          >
            {initials(project?.name ?? key)}
          </span>
          <span className="flex min-w-0 flex-col gap-px">
            <span className="truncate text-13h font-semibold">{project?.name ?? key}</span>
            <span className="text-12 text-tx4">
              {project?.method === 'kanban' ? 'Kanban project' : 'Software project'}
            </span>
          </span>
        </div>
      }
    >
      <SettingsNavSection label="Planning">
        <SettingsNavItem active href={`/work/backlog/${key}`}>
          Backlog
        </SettingsNavItem>
        <SettingsNavItem href={`/work/board/${key}`}>Board</SettingsNavItem>
      </SettingsNavSection>
    </SettingsNav>
  );
}

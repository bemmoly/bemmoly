import { SettingsNav, SettingsNavItem, SettingsNavSection } from '@bemmoly/ui';
import type { Project } from '../../../shared/index.ts';
import { onLinkClick, workflowPaths } from './navigate.ts';

/**
 * The project settings sidebar of the Workflow mock, with Workflow current.
 * The other pages are not built yet, so they are listed without links; the
 * board settings stream owns this frame once it lands.
 */
export function ProjectSettingsNav({ project }: { project: Project | undefined }) {
  const name = project?.name ?? 'Project';
  const workflows = project ? workflowPaths.list(project.key) : undefined;
  return (
    <SettingsNav
      label="Project settings"
      title={
        <div className="flex items-center gap-2.5 px-2 pt-0 pb-1">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-sm bg-ac-fill font-semibold text-on-ac"
          >
            {(project?.key ?? '').slice(0, 2)}
          </span>
          <span className="flex flex-col gap-px">
            <span className="text-13h font-semibold">{name}</span>
            <span className="text-12 text-tx4">Project settings</span>
          </span>
        </div>
      }
      footer={
        <span className="leading-body">
          Workflows are shared from the org default unless the project has its own copy. Changes
          here apply when you publish.
        </span>
      }
    >
      <SettingsNavSection label="Project">
        <SettingsNavItem>Details</SettingsNavItem>
        <SettingsNavItem>Access</SettingsNavItem>
        <SettingsNavItem>Notifications</SettingsNavItem>
      </SettingsNavSection>
      <SettingsNavSection label="Work">
        <SettingsNavItem>Issue types and fields</SettingsNavItem>
        <SettingsNavItem
          active
          {...(workflows
            ? { href: workflows, linkProps: { onClick: onLinkClick(workflows) } }
            : {})}
        >
          Workflow
        </SettingsNavItem>
        <SettingsNavItem>Board</SettingsNavItem>
        <SettingsNavItem>Automation</SettingsNavItem>
      </SettingsNavSection>
    </SettingsNav>
  );
}

import type { Project, SchemeKind, SchemeStatus } from '@bemmoly/module-work/shared';
import { SettingsNav, SettingsNavItem, SettingsNavSection } from '@bemmoly/ui';

export const SETTINGS_PAGES = ['board', 'issue-types', 'fields'] as const;
export type SettingsPage = (typeof SETTINGS_PAGES)[number];

export const isSettingsPage = (value: string | undefined): value is SettingsPage =>
  (SETTINGS_PAGES as readonly string[]).includes(value ?? '');

/** "Platform Core" → "PC", the project tile of the settings sidebar. */
const tileOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

export interface ProjectSettingsNavProps {
  project: Project | undefined;
  current: SettingsPage;
  schemes: readonly SchemeStatus[];
  /** Whether the person can change these settings, for the footer line. */
  canConfigure: boolean;
  onOpen: (page: SettingsPage) => void;
}

/**
 * The project settings sidebar of the Board Settings mock, limited to the
 * pages that exist: issue types, fields, the workflow (its own screen) and
 * the board. Each scheme says whether it is the org default or overridden.
 */
export function ProjectSettingsNav({
  project,
  current,
  schemes,
  canConfigure,
  onOpen,
}: ProjectSettingsNavProps) {
  const meta = (kind: SchemeKind) => {
    const status = schemes.find((item) => item.kind === kind);
    if (!status) return {};
    return status.overridden
      ? { meta: 'Overridden', metaTone: 'accent' as const }
      : { meta: 'Org default' };
  };
  const item = (page: SettingsPage, label: string, kind?: SchemeKind) => (
    <SettingsNavItem
      active={current === page}
      {...(kind ? meta(kind) : {})}
      onClick={() => onOpen(page)}
    >
      {label}
    </SettingsNavItem>
  );
  return (
    <SettingsNav
      label="Project settings"
      title={
        <div className="flex items-center gap-2.5 px-2 pb-1">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-panel bg-linear-135 from-ac-fill to-ac-l font-semibold text-on-ac">
            {tileOf(project?.name ?? '')}
          </span>
          <div className="flex min-w-0 flex-col gap-px">
            <span className="truncate text-13h font-semibold">{project?.name ?? 'Project'}</span>
            <span className="text-12 text-tx4">Project settings</span>
          </div>
        </div>
      }
      footer={
        <>
          <span>
            {canConfigure
              ? 'You can change these settings.'
              : 'You can view these settings; changing them needs a project admin.'}
          </span>
          <span>
            Org-level defaults are set in{' '}
            <a href="/settings" className="text-ac hover:text-ac-d">
              Workspace settings
            </a>
            .
          </span>
        </>
      }
    >
      <SettingsNavSection label="Work">
        {item('issue-types', 'Issue types', 'issue_types')}
        {item('fields', 'Fields', 'fields')}
        <SettingsNavItem href={`/work/workflow/${project?.key ?? ''}`} {...meta('workflow')}>
          Workflow
        </SettingsNavItem>
        {item('board', 'Board')}
      </SettingsNavSection>
    </SettingsNav>
  );
}

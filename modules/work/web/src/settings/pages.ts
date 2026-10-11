/** The project settings pages the settings screen draws; Members and Workflow have their own. */
export const SETTINGS_PAGES = [
  'board',
  'issue-types',
  'fields',
  'development',
  'automation',
] as const;
export type SettingsPage = (typeof SETTINGS_PAGES)[number];

export const isSettingsPage = (value: string | undefined): value is SettingsPage =>
  (SETTINGS_PAGES as readonly string[]).includes(value ?? '');

/** Where a project settings page lives under the Work chunk. */
export const settingsPath = (projectKey: string, page: SettingsPage) =>
  `/work/settings/${projectKey}/${page}`;

/**
 * Where a settings page reads and writes: the org defaults in workspace Settings › Work, or
 * one project's settings, which follow those defaults until the project overrides them.
 */
export type SettingsScope = { kind: 'org' } | { kind: 'project'; projectKey: string | undefined };

export const ORG_SCOPE: SettingsScope = { kind: 'org' };
export const projectScope = (projectKey: string | undefined): SettingsScope => ({
  kind: 'project',
  projectKey,
});

/** The org default pages under Settings › Work, in the order of a project's settings tabs. */
export const ORG_SETTINGS_PAGES = ['issue-types', 'fields', 'workflow', 'board'] as const;
export type OrgSettingsPage = (typeof ORG_SETTINGS_PAGES)[number];

export const isOrgSettingsPage = (value: string | undefined): value is OrgSettingsPage =>
  (ORG_SETTINGS_PAGES as readonly string[]).includes(value ?? '');

/** Where an org default page lives: /settings/work/<page>, a workflow under its list. */
export const orgSettingsPath = (page: OrgSettingsPage, workflowId?: string) =>
  `/settings/work/${page}${workflowId ? `/${workflowId}` : ''}`;

/** The project settings pages the settings screen draws; Members and Workflow have their own. */
export const SETTINGS_PAGES = ['board', 'issue-types', 'fields'] as const;
export type SettingsPage = (typeof SETTINGS_PAGES)[number];

export const isSettingsPage = (value: string | undefined): value is SettingsPage =>
  (SETTINGS_PAGES as readonly string[]).includes(value ?? '');

/** Where a project settings page lives under the Work chunk. */
export const settingsPath = (projectKey: string, page: SettingsPage) =>
  `/work/settings/${projectKey}/${page}`;

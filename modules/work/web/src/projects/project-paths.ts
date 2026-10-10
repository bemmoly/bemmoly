/**
 * Where a project's pages live. Settings sections are tabs of one settings page, Members among
 * them; the shell's header draws the tabs, these pages draw what is under them.
 */
export type ProjectSettingsTab =
  'general' | 'members' | 'issue-types' | 'fields' | 'workflow' | 'board';

export const projectPaths = {
  backlog: (key: string) => `/work/backlog/${key}`,
  settings: (key: string, tab: ProjectSettingsTab = 'general') => `/work/settings/${key}/${tab}`,
  members: (key: string) => `/work/settings/${key}/members`,
};

import { workPaths } from '../hooks/issue-navigation.ts';

/**
 * Where a project's pages live, as the frame's header tabs name them: settings open on their
 * first section, and Members is one of those sections.
 */
export const projectPaths = {
  backlog: workPaths.backlog,
  settings: workPaths.settings,
  members: (key: string) => `/work/members/${key}`,
};

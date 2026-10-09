import type { WorkScreenProps } from '../routes.tsx';
import { useSettingsAccess } from '../hooks/settings-access.ts';
import { useSchemes } from '../hooks/settings-schemes.ts';
import { useProject } from '../shared/index.ts';
import { navigate } from '../workflow/navigate.ts';
import { BoardSettingsPage } from './board/board-settings-page.tsx';
import {
  isSettingsPage,
  ProjectSettingsNav,
  settingsPath,
  type SettingsPage,
} from './project-nav.tsx';
import { FieldsPage } from './schemes/fields-page.tsx';
import { IssueTypesPage } from './schemes/issue-types-page.tsx';

/**
 * /work/settings/<KEY>/<page>: a project's settings, the board by default.
 * Moving between pages goes through the browser history, so Back works and
 * the module is not reloaded.
 */
export default function SettingsScreen({ projectKey, rest }: WorkScreenProps) {
  const page: SettingsPage = isSettingsPage(rest[0]) ? rest[0] : 'board';
  const { project } = useProject(projectKey);
  const schemes = useSchemes(project?.id);
  const access = useSettingsAccess();
  const key = project?.key ?? projectKey ?? '';

  const nav = (onOpen: (next: SettingsPage) => void) => (
    <ProjectSettingsNav
      project={project}
      current={page}
      schemes={schemes.list.data?.items ?? []}
      canConfigure={access.configureBoard || access.configureProject}
      onOpen={onOpen}
    />
  );
  const open = (next: SettingsPage) => navigate(settingsPath(key, next));

  if (page === 'issue-types') return <IssueTypesPage projectKey={projectKey} nav={nav(open)} />;
  if (page === 'fields') return <FieldsPage projectKey={projectKey} nav={nav(open)} />;
  return (
    <BoardSettingsPage
      projectKey={projectKey}
      nav={(guard) => nav((next) => guard(() => open(next)))}
    />
  );
}

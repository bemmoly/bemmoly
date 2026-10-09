import { useState } from 'react';
import type { WorkScreenProps } from '../routes.tsx';
import { useSettingsAccess } from '../hooks/settings-access.ts';
import { useSchemes } from '../hooks/settings-schemes.ts';
import { useProject } from '../shared/index.ts';
import { BoardSettingsPage } from './board/board-settings-page.tsx';
import { isSettingsPage, ProjectSettingsNav, type SettingsPage } from './project-nav.tsx';
import { FieldsPage } from './schemes/fields-page.tsx';
import { IssueTypesPage } from './schemes/issue-types-page.tsx';

/**
 * /work/settings/<KEY>/<page>: a project's settings. The page is kept here
 * and written to the address in place (the shell's router state is kept), so
 * moving between settings pages does not reload the module.
 */
export default function SettingsScreen({ projectKey, rest }: WorkScreenProps) {
  const [page, setPage] = useState<SettingsPage>(isSettingsPage(rest[0]) ? rest[0] : 'board');
  const { project } = useProject(projectKey);
  const schemes = useSchemes(project?.id);
  const access = useSettingsAccess();
  const key = project?.key ?? projectKey ?? '';

  const open = (next: SettingsPage) => {
    setPage(next);
    window.history.replaceState(window.history.state, '', `/work/settings/${key}/${next}`);
  };
  const nav = (onOpen: (next: SettingsPage) => void, current: SettingsPage) => (
    <ProjectSettingsNav
      project={project}
      current={current}
      schemes={schemes.list.data?.items ?? []}
      canConfigure={access.configureBoard || access.configureProject}
      onOpen={onOpen}
    />
  );

  if (page === 'issue-types')
    return <IssueTypesPage projectKey={projectKey} nav={nav(open, page)} />;
  if (page === 'fields') return <FieldsPage projectKey={projectKey} nav={nav(open, page)} />;
  return (
    <BoardSettingsPage
      projectKey={projectKey}
      nav={(guard, current) => nav((next) => guard(() => open(next)), current)}
    />
  );
}

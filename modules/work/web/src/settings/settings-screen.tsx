import type { WorkScreenProps } from '../routes.tsx';
import { AutomationPage } from './automation/automation-page.tsx';
import { BoardSettingsPage } from './board/board-settings-page.tsx';
import { DevelopmentPage } from './development-page.tsx';
import { isSettingsPage, projectScope, type SettingsPage } from './pages.ts';
import { FieldsPage } from './schemes/fields-page.tsx';
import { IssueTypesPage } from './schemes/issue-types-page.tsx';

/**
 * /work/settings/<KEY>/<page>: a project's settings, the board by default. The sections are
 * the header's tabs (Work's frame), so moving between them goes through the browser history
 * and Back works.
 */
export default function SettingsScreen({ projectKey, rest }: WorkScreenProps) {
  const page: SettingsPage = isSettingsPage(rest[0]) ? rest[0] : 'board';
  const scope = projectScope(projectKey);
  if (page === 'issue-types') return <IssueTypesPage scope={scope} />;
  if (page === 'fields') return <FieldsPage scope={scope} />;
  if (page === 'development') return <DevelopmentPage projectKey={projectKey} />;
  if (page === 'automation') return <AutomationPage projectKey={projectKey} />;
  return <BoardSettingsPage scope={scope} />;
}

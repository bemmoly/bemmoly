import type { WorkScreenProps } from '../routes.tsx';
import { BoardSettingsPage } from './board/board-settings-page.tsx';
import { isSettingsPage, type SettingsPage } from './pages.ts';
import { FieldsPage } from './schemes/fields-page.tsx';
import { IssueTypesPage } from './schemes/issue-types-page.tsx';

/**
 * /work/settings/<KEY>/<page>: a project's settings, the board by default. The sections are
 * the header's tabs (Work's frame), so moving between them goes through the browser history
 * and Back works.
 */
export default function SettingsScreen({ projectKey, rest }: WorkScreenProps) {
  const page: SettingsPage = isSettingsPage(rest[0]) ? rest[0] : 'board';
  if (page === 'issue-types') return <IssueTypesPage projectKey={projectKey} />;
  if (page === 'fields') return <FieldsPage projectKey={projectKey} />;
  return <BoardSettingsPage projectKey={projectKey} />;
}

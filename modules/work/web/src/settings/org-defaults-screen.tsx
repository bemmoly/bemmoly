import { useSettingsAccess } from '../hooks/settings-access.ts';
import { WorkflowEditor } from '../workflow/workflow-editor.tsx';
import { WorkflowsList } from '../workflow/workflows-list.tsx';
import { BoardSettingsPage } from './board/board-settings-page.tsx';
import { OrgDefaultNote } from './org-default-note.tsx';
import { PermissionsPage } from './permissions/permissions-page.tsx';
import { ORG_SCOPE, orgSettingsPath, type OrgSettingsPage } from './pages.ts';
import { FieldsPage } from './schemes/fields-page.tsx';
import { IssueTypesPage } from './schemes/issue-types-page.tsx';

/** The org default workflow: its list with who runs it, or the editor for one workflow. */
function OrgWorkflow({ workflowId }: { workflowId: string | undefined }) {
  const access = useSettingsAccess();
  if (workflowId) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <WorkflowEditor
          key={workflowId}
          workflowId={workflowId}
          listPath={orgSettingsPath('workflow')}
        />
      </div>
    );
  }
  return (
    <WorkflowsList
      project={null}
      editorPath={(id) => orgSettingsPath('workflow', id)}
      note={<OrgDefaultNote kind="workflow" enabled={access.orgAdmin} />}
    />
  );
}

/**
 * Settings › Work: the org defaults every project inherits until it overrides them, drawn
 * by the same pages a project's settings use, in the org scope.
 */
export default function OrgDefaultsScreen({
  page,
  workflowId,
}: {
  page: OrgSettingsPage;
  workflowId: string | undefined;
}) {
  if (page === 'fields') return <FieldsPage scope={ORG_SCOPE} />;
  if (page === 'workflow') return <OrgWorkflow workflowId={workflowId} />;
  if (page === 'board') return <BoardSettingsPage scope={ORG_SCOPE} />;
  if (page === 'permissions') return <PermissionsPage />;
  return <IssueTypesPage scope={ORG_SCOPE} />;
}

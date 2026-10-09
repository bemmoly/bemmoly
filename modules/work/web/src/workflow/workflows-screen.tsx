import { EmptyState, SettingsFrame } from '@bemmoly/ui';
import { useSettingsAccess } from '../hooks/settings-access.ts';
import { useSchemes } from '../hooks/settings-schemes.ts';
import type { WorkScreenProps } from '../routes.tsx';
import { ProjectSettingsNav, settingsPath } from '../settings/project-nav.tsx';
import { useProject } from '../shared/index.ts';
import { WorkflowEditorSkeleton } from '../skeletons/settings-skeleton.tsx';
import { navigate, workflowPaths } from './navigate.ts';
import { WorkflowEditor } from './workflow-editor.tsx';
import { WorkflowsList } from './workflows-list.tsx';

/**
 * Work settings › Workflows: /work/workflows/PLT lists the workflows the
 * project can run, /work/workflows/PLT/<id> opens one in the editor.
 */
export default function WorkflowsScreen({ projectKey, rest }: WorkScreenProps) {
  const { project, isPending } = useProject(projectKey);
  const schemes = useSchemes(project?.id);
  const access = useSettingsAccess();
  const workflowId = rest[0];
  let content;
  if (isPending) content = workflowId ? <WorkflowEditorSkeleton /> : null;
  else if (!project)
    content = (
      <EmptyState
        title="No such project"
        description="Pick a project you can see, then open its workflows."
      />
    );
  else if (workflowId)
    content = (
      <WorkflowEditor
        key={workflowId}
        project={project}
        workflowId={workflowId}
        listPath={workflowPaths.list(project.key)}
      />
    );
  else
    content = (
      <WorkflowsList project={project} editorPath={(id) => workflowPaths.editor(project.key, id)} />
    );
  return (
    <SettingsFrame
      nav={
        <ProjectSettingsNav
          project={project}
          current="workflow"
          schemes={schemes.list.data?.items ?? []}
          canConfigure={access.configureBoard || access.configureProject}
          onOpen={(page) => project && navigate(settingsPath(project.key, page))}
        />
      }
      className="min-w-0"
    >
      <div className="flex h-full min-h-0 flex-col">{content}</div>
    </SettingsFrame>
  );
}

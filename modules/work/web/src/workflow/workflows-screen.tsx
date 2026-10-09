import { EmptyState, SettingsFrame, Skeleton } from '@bemmoly/ui';
import type { WorkScreenProps } from '../routes.tsx';
import { useProject } from '../shared/index.ts';
import { workflowPaths } from './navigate.ts';
import { ProjectSettingsNav } from './project-settings-nav.tsx';
import { WorkflowEditor } from './workflow-editor.tsx';
import { WorkflowsList } from './workflows-list.tsx';

/**
 * Work settings › Workflows: /work/workflows/PLT lists the workflows the
 * project can run, /work/workflows/PLT/<id> opens one in the editor.
 */
export default function WorkflowsScreen({ projectKey, rest }: WorkScreenProps) {
  const { project, isPending } = useProject(projectKey);
  const workflowId = rest[0];
  let content;
  if (isPending) content = <Skeleton className="m-6 h-40" />;
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
    <SettingsFrame nav={<ProjectSettingsNav project={project} />} className="min-w-0">
      <div className="flex h-full min-h-0 flex-col">{content}</div>
    </SettingsFrame>
  );
}

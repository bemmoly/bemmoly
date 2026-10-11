import { EmptyState } from '@bemmoly/ui';
import type { WorkScreenProps } from '../routes.tsx';
import { useProject } from '../shared/index.ts';
import { WorkflowEditorSkeleton } from '../skeletons/settings-skeleton.tsx';
import { workflowPaths } from './navigate.ts';
import { WorkflowEditor } from './workflow-editor.tsx';
import { WorkflowsList } from './workflows-list.tsx';

/**
 * Project settings › Workflow: /work/workflows/PLT lists the workflows the project can run,
 * /work/workflows/PLT/<id> opens one in the editor, full width.
 */
export default function WorkflowsScreen({ projectKey, rest }: WorkScreenProps) {
  const { project, isPending } = useProject(projectKey);
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
  return <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">{content}</div>;
}

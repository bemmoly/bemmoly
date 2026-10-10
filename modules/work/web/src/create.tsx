import type { CreateOverlayProps, ModuleCreateDialogs } from '@bemmoly/core-web';
import type { Project } from '@bemmoly/module-work/shared';
import { useToast } from '@bemmoly/ui';
import { CreateIssueDialog } from './create/create-issue-dialog.tsx';
import { workPaths } from './hooks/issue-navigation.ts';
import { useSprints } from './hooks/projects-catalog.ts';
import { CreateProjectDialog } from './projects/create-project-dialog.tsx';
import { useProject } from './shared/use-project.ts';

/**
 * A new issue over whatever page is showing, in the project the person is working in. It
 * stays on the page: the toast offers to open the new issue, so a quick capture never loses
 * the board behind it.
 */
function NewIssue({ onClose }: CreateOverlayProps) {
  const { project, isPending } = useProject();
  const sprints = useSprints(project?.key);
  // Over a Scrum board, new work joins the sprint on screen, as a column's own create does.
  const onBoard = project ? window.location.pathname.endsWith(workPaths.board(project.key)) : false;
  const running = sprints.data?.find((sprint) => sprint.state === 'active');
  if (isPending || (onBoard && sprints.isPending)) return null;
  return (
    <CreateIssueDialog
      open
      projectKey={project?.key}
      {...(onBoard && running ? { initial: { sprintId: running.id } } : {})}
      onClose={onClose}
    />
  );
}

/** A new project, then its board, with a toast saying how its issues are numbered. */
function NewProject({ onClose, onCreated }: CreateOverlayProps) {
  const toast = useToast();
  const created = (project: Project) => {
    toast.show({
      tone: 'ok',
      title: `Created ${project.name}`,
      body: `Issues in it are numbered ${project.key}-1, ${project.key}-2 and on.`,
    });
    onCreated(workPaths.board(project.key));
  };
  return <CreateProjectDialog open onClose={onClose} onCreated={created} />;
}

/** Work's create dialogs by the create entry ids module.ts registers. */
const dialogs: ModuleCreateDialogs = {
  'work.create-issue': NewIssue,
  'work.create-project': NewProject,
};

export default dialogs;

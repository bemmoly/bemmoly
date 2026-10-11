import type { CreateOverlayProps, ModuleCreateDialogs } from '@bemmoly/core-web';
import type { Project } from '@bemmoly/module-work/shared';
import { useToast } from '@bemmoly/ui';
import { useState } from 'react';
import { CreateIssueDialog } from './create/create-issue-dialog.tsx';
import { workPaths } from './hooks/issue-navigation.ts';
import { useSprints } from './hooks/projects-catalog.ts';
import { CreateProjectDialog } from './projects/create-project-dialog.tsx';
import { projectKeyInPath } from './shared/project-in-path.ts';
import { useProject } from './shared/use-project.ts';

interface Start {
  projectKey: string | undefined;
  sprintId: string | undefined;
}

/**
 * A new issue over whatever page is showing, in the project the person is working in: the one
 * the address names, else their last one. It stays on the page: the toast offers to open the
 * new issue, so a quick capture never loses the board behind it.
 *
 * The project and sprint are read once, when the dialog first shows, and kept. A board that
 * finishes loading behind the dialog, or a project remembered a moment later, must not swap
 * the project under the person, or unmount the form and the picker they have open.
 */
function NewIssue({ onClose }: CreateOverlayProps) {
  const { project, isPending } = useProject(projectKeyInPath(window.location.pathname));
  const sprints = useSprints(project?.key);
  const [start, setStart] = useState<Start | null>(null);
  // Over a Scrum board, new work joins the sprint on screen, as a column's own create does.
  const onBoard = project ? window.location.pathname.endsWith(workPaths.board(project.key)) : false;
  if (!start && !isPending && !(onBoard && sprints.isPending)) {
    const running = onBoard ? sprints.data?.find((sprint) => sprint.state === 'active') : undefined;
    setStart({ projectKey: project?.key, sprintId: running?.id });
  }
  if (!start) return null;
  return (
    <CreateIssueDialog
      open
      projectKey={start.projectKey}
      {...(start.sprintId ? { initial: { sprintId: start.sprintId } } : {})}
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

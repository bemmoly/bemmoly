import { navigateBack, navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import ProjectsScreen from '../projects/projects-screen.tsx';
import type { WorkScreenProps } from '../routes.tsx';
import { useProject } from '../shared/use-project.ts';
import { CreateIssueDialog } from './create-issue-dialog.tsx';

/**
 * /work/create and /work/create/PLT, where the top bar's Create menu leads: the create form
 * over the project list, starting in the named or the last used project. Closing goes back
 * to where the person was; creating opens the new issue.
 */
export default function CreateScreen({ projectKey }: WorkScreenProps) {
  const { project, isPending } = useProject(projectKey);
  return (
    <>
      <ProjectsScreen projectKey={undefined} rest={[]} />
      {!isPending && (
        <CreateIssueDialog
          open
          projectKey={project?.key}
          onClose={() => navigateBack(workPaths.projects())}
          onCreated={(issue) => navigateTo(workPaths.issue(issue.key))}
        />
      )}
    </>
  );
}

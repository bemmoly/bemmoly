import { EmptyState } from '@bemmoly/ui';
import type { WorkScreenProps } from '../routes.tsx';
import { useProject } from '../shared/index.ts';

/** The Board screen; the columns, lanes and slide-over follow in their own commits. */
export default function BoardScreen({ projectKey }: WorkScreenProps) {
  const { project } = useProject(projectKey);
  return (
    <EmptyState
      title={project ? `${project.name} board` : 'Board'}
      description="The board is on its way."
    />
  );
}

import { navigateInApp, withCreate } from '@bemmoly/core-web';
import { useEffect } from 'react';
import { workPaths } from '../hooks/issue-navigation.ts';
import type { WorkScreenProps } from '../routes.tsx';
import { useProject } from '../shared/use-project.ts';
import { BoardSkeleton } from '../skeletons/board-skeleton.tsx';

/**
 * /work/create and /work/create/PLT, kept for old links and bookmarks: they become the
 * project's board with the create dialog open over it, replacing this address, so Close
 * leaves the person on a real page and Back does not bounce through here.
 */
export default function CreateScreen({ projectKey }: WorkScreenProps) {
  const { project, isPending } = useProject(projectKey);
  const key = project?.key;
  useEffect(() => {
    if (isPending) return;
    const page = key ? workPaths.board(key) : workPaths.projects();
    navigateInApp(withCreate(page, 'work.create-issue'), { replace: true });
  }, [isPending, key]);
  return <BoardSkeleton />;
}

import { useRecordRecent, useScreenActions } from '@bemmoly/core-web';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';

/** The backlog as a recent item and its palette actions, once its project is known. */
export function useBacklogInShell(project: { key: string; name: string } | undefined) {
  useRecordRecent(
    project
      ? {
          id: `work.backlog:${project.key}`,
          title: 'Backlog',
          context: project.name,
          path: workPaths.backlog(project.key),
          look: { kind: 'icon', icon: 'backlog', moduleId: 'work' },
          group: 'Boards',
        }
      : null,
  );
  useScreenActions(
    project
      ? [
          {
            id: 'work.go-board',
            title: 'Go to board',
            keys: 'G B',
            look: { kind: 'icon', icon: 'board' },
            run: () => navigateTo(workPaths.board(project.key)),
          },
        ]
      : null,
  );
}

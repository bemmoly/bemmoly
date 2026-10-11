import { useRecordRecent, useScreenActions } from '@bemmoly/core-web';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';

/** The board as a recent item and its palette actions, once its project is known. */
export function useBoardInShell(project: { key: string; name: string } | undefined) {
  useRecordRecent(
    project
      ? {
          id: `work.board:${project.key}`,
          title: 'Board',
          context: project.name,
          path: workPaths.board(project.key),
          look: { kind: 'icon', icon: 'board', moduleId: 'work' },
          group: 'Boards',
        }
      : null,
  );
  useScreenActions(
    project
      ? [
          {
            id: 'work.go-backlog',
            title: 'Go to backlog',
            keys: 'G L',
            look: { kind: 'icon', icon: 'backlog' },
            run: () => navigateTo(workPaths.backlog(project.key)),
          },
        ]
      : null,
  );
}

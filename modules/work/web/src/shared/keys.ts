import { queryKeys } from '@bemmoly/api-client';
import type { BoardViewQuery } from '@bemmoly/module-work/shared';

/**
 * Every Work query key, nested under the api-client's `work` root so one
 * work.* realtime event invalidates all of them. Each screen adds its own
 * group here; the second element names the group so a group can be
 * invalidated on its own.
 */
export const workKeys = {
  all: () => queryKeys.work(),
  projects: () => [...queryKeys.work(), 'projects'] as const,
  project: (projectId: string) => [...queryKeys.work(), 'project', projectId] as const,
  boards: (projectId: string) => [...workKeys.project(projectId), 'boards'] as const,
  /** Every cached board view, whatever its board or query. */
  boardViews: () => [...queryKeys.work(), 'board-view'] as const,
  boardView: (boardId: string, query: BoardViewQuery = {}) =>
    [...workKeys.boardViews(), boardId, query] as const,
  sprints: (projectId: string) => [...workKeys.project(projectId), 'sprints'] as const,
  workflows: (projectId: string) => [...workKeys.project(projectId), 'workflows'] as const,
  issueTypes: (projectId: string) => [...workKeys.project(projectId), 'issue-types'] as const,
  labels: (projectId: string) => [...workKeys.project(projectId), 'labels'] as const,
  issue: (key: string) => [...queryKeys.work(), 'issue', key] as const,
  myIssues: () => [...queryKeys.work(), 'my-issues'] as const,
  issueTransitions: (key: string) => [...workKeys.issue(key), 'transitions'] as const,
  boardMetrics: (boardId: string) => [...queryKeys.work(), 'board-metrics', boardId] as const,
  /** Mutation keys of card moves in flight; a board's view is not read again while one is. */
  boardMoves: () => [...queryKeys.work(), 'board-moves'] as const,
  boardMove: (boardId: string) => [...workKeys.boardMoves(), boardId] as const,
  /** Mutation keys of quick edits (assign, priority, sprint) in flight, one per issue. */
  issueEdits: () => [...queryKeys.work(), 'issue-edits'] as const,
  issueEdit: (key: string) => [...workKeys.issueEdits(), key] as const,
} as const;

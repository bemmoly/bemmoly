import { queryKeys } from '@bemmoly/api-client';
import type { BoardViewQuery, RoadmapQueryInput } from '@bemmoly/module-work/shared';

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
  /** Every cached roadmap, whatever its projects or team. */
  roadmaps: () => [...queryKeys.work(), 'roadmap'] as const,
  roadmap: (query: RoadmapQueryInput) => [...workKeys.roadmaps(), query] as const,
  /** Every cached initiative list and initiative. */
  initiatives: () => [...queryKeys.work(), 'initiatives'] as const,
  initiativeList: (archived: boolean) => [...workKeys.initiatives(), 'list', archived] as const,
  initiative: (id: string) => [...workKeys.initiatives(), 'one', id] as const,
  pairing: (projectKey: string, range: string) =>
    [...queryKeys.work(), 'pairing', projectKey, range] as const,
  sprintReport: (sprintId: string) => [...queryKeys.work(), 'sprint-report', sprintId] as const,
  flowReport: (projectKey: string, days: number) =>
    [...queryKeys.work(), 'flow-report', projectKey, days] as const,
  cycleReport: (projectKey: string, report: 'control' | 'time-in-status', days: number) =>
    [...queryKeys.work(), 'cycle-report', projectKey, report, days] as const,
  scopeReport: (projectKey: string, kind: string, id: string | null) =>
    [...queryKeys.work(), 'scope-report', projectKey, kind, id] as const,
  timeTrackingReport: (projectKey: string, days: number, sprintId: string | null) =>
    [...queryKeys.work(), 'time-tracking-report', projectKey, days, sprintId] as const,
  reportStats: (projectKey: string, by: string, by2: string | null) =>
    [...queryKeys.work(), 'report-stats', projectKey, by, by2] as const,
  /** The caller's dashboards on a project. */
  dashboards: (projectKey: string) => [...queryKeys.work(), 'dashboards', projectKey] as const,
  quarterReport: (projectKey: string, quarter: string) =>
    [...queryKeys.work(), 'quarter-report', projectKey, quarter] as const,
  issueTransitions: (key: string) => [...workKeys.issue(key), 'transitions'] as const,
  boardMetrics: (boardId: string) => [...queryKeys.work(), 'board-metrics', boardId] as const,
  /** Mutation keys of card moves in flight; a board's view is not read again while one is. */
  boardMoves: () => [...queryKeys.work(), 'board-moves'] as const,
  boardMove: (boardId: string) => [...workKeys.boardMoves(), boardId] as const,
  /** Mutation keys of quick edits (assign, priority, sprint) in flight, one per issue. */
  issueEdits: () => [...queryKeys.work(), 'issue-edits'] as const,
  issueEdit: (key: string) => [...workKeys.issueEdits(), key] as const,
} as const;

import { workKeys } from '../shared/keys.ts';

/**
 * Query keys of the Issue page, the create form and the project list. Every key sits under
 * the issue's own key, or under the work root, so one realtime event or one mutation can
 * refresh the lot.
 */
export const issueKeys = {
  detail: (key: string) => workKeys.issue(key),
  transitions: (key: string) => [...workKeys.issue(key), 'transitions'] as const,
  comments: (key: string) => [...workKeys.issue(key), 'comments'] as const,
  history: (key: string) => [...workKeys.issue(key), 'history'] as const,
  workLogs: (key: string) => [...workKeys.issue(key), 'work-logs'] as const,
  watchers: (key: string) => [...workKeys.issue(key), 'watchers'] as const,
  subtasks: (issueId: string) => [...workKeys.all(), 'subtasks', issueId] as const,
  people: () => [...workKeys.all(), 'people'] as const,
  catalog: (projectKey: string, part: string) =>
    [...workKeys.all(), 'catalog', projectKey, part] as const,
  layout: (projectKey: string, typeId: string) =>
    [...workKeys.all(), 'catalog', projectKey, 'layout', typeId] as const,
  statuses: (projectId: string) => [...workKeys.all(), 'statuses', projectId] as const,
};

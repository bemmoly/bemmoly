import {
  backlogSchema,
  createIssueBodySchema,
  issueSchema,
  moveIssueBodySchema,
  type CreateIssueBody,
  type MoveIssueBody,
} from '../../../shared/index.ts';
import { queryKeys, type Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

const BASE = '/api/v1/work';

/** The Backlog's read, nested under the work root so every work.* event refreshes it. */
export const backlogKeys = {
  backlog: (projectKey: string) => [...queryKeys.work(), 'backlog', projectKey] as const,
};

/**
 * The Backlog screen in one read, the drop that moves an issue between
 * sprints and the backlog, and the inline create at the foot of a container.
 */
export function workBacklogEndpoints(http: Http) {
  return {
    backlog: {
      get: async (projectKey: string) =>
        http.request(`${BASE}/projects/${enc(projectKey)}/backlog`, backlogSchema),
      /**
       * `beforeIssueId` is the row that ends up above the issue and
       * `afterIssueId` the one below it, as the server's rank reads them;
       * `sprintId` (null for the backlog) changes container and is left out
       * to stay in the current one.
       */
      move: async (issueKey: string, body: MoveIssueBody) =>
        http.request(`${BASE}/issues/${enc(issueKey)}/move`, issueSchema, {
          method: 'POST',
          body: validated(moveIssueBodySchema, body),
        }),
      createIssue: async (body: CreateIssueBody) =>
        http.request(`${BASE}/issues`, issueSchema, {
          method: 'POST',
          body: validated(createIssueBodySchema, body),
        }),
    },
  };
}

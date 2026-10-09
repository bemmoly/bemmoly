import {
  issueDetailSchema,
  issueSchema,
  issueTransitionsResponseSchema,
  labelsResponseSchema,
  rankIssueBodySchema,
  updateIssueBodySchema,
  type RankIssueBody,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

const BASE = '/api/v1/work';

/**
 * What the Board needs of issues: the slide-over read, the two drop actions and the labels
 * cards are painted with. The Issue page's own calls live with the issue screens.
 */
export function workBoardIssuesEndpoints(http: Http) {
  return {
    boardIssues: {
      get: async (key: string) => http.request(`${BASE}/issues/${enc(key)}`, issueDetailSchema),
      /** A drop within a column: the new neighbours, the server writes the rank. */
      rank: async (key: string, body: RankIssueBody) =>
        http.request(`${BASE}/issues/${enc(key)}/rank`, issueSchema, {
          method: 'PATCH',
          body: validated(rankIssueBodySchema, body),
        }),
      /** The transitions out of the issue's status, with why each blocked one is blocked. */
      transitions: async (key: string) =>
        (
          await http.request(
            `${BASE}/issues/${enc(key)}/transitions`,
            issueTransitionsResponseSchema,
          )
        ).items,
      /**
       * A drop into another column. A status change is a transition: the issue service asks the
       * workflow, which refuses a move no transition allows or one whose rules block it.
       */
      transition: async (key: string, statusId: string) =>
        http.request(`${BASE}/issues/${enc(key)}`, issueSchema, {
          method: 'PATCH',
          body: validated(updateIssueBodySchema, { statusId }),
        }),
    },
    labels: {
      list: async (projectId: string) =>
        (await http.request(`${BASE}/projects/${enc(projectId)}/labels`, labelsResponseSchema))
          .items,
    },
  };
}

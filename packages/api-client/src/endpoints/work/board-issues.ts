import {
  issueSchema,
  issueTypesResponseSchema,
  labelsResponseSchema,
  rankIssueBodySchema,
  transitionIssueBodySchema,
  type RankIssueBody,
  type TransitionIssueBody,
} from '@bemmoly/module-work/shared';
import type { Http } from '../../http.ts';
import { enc, validated } from '../validate.ts';

const BASE = '/api/v1/work';

/**
 * What the Board needs of issues: the slide-over read, the two drop actions and the per-project
 * vocabularies cards are painted with. The Issue page's own calls live in issues.ts.
 */
export function workBoardIssuesEndpoints(http: Http) {
  return {
    boardIssues: {
      get: async (key: string) => http.request(`${BASE}/issues/${enc(key)}`, issueSchema),
      /** A drop within a column: the new neighbours, the server writes the rank. */
      rank: async (key: string, body: RankIssueBody) =>
        http.request(`${BASE}/issues/${enc(key)}/rank`, issueSchema, {
          method: 'POST',
          body: validated(rankIssueBodySchema, body),
        }),
      /** A drop into another column: the workflow transition into its first status. */
      transition: async (key: string, body: TransitionIssueBody) =>
        http.request(`${BASE}/issues/${enc(key)}/transition`, issueSchema, {
          method: 'POST',
          body: validated(transitionIssueBodySchema, body),
        }),
    },
    issueTypes: {
      list: async (projectId: string) =>
        http.request(`${BASE}/projects/${enc(projectId)}/types`, issueTypesResponseSchema),
    },
    labels: {
      list: async (projectId: string) =>
        http.request(`${BASE}/projects/${enc(projectId)}/labels`, labelsResponseSchema),
    },
  };
}

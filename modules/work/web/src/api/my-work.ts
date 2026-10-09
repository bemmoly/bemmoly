import type { Http } from '@bemmoly/api-client';
import { myIssuesSchema } from '../../../shared/index.ts';

/** Home's "my work": the signed-in person's assigned, reported and watched issues. */
export function workMyWorkEndpoints(http: Http) {
  return {
    myIssues: async (limit = 6) =>
      http.request('/api/v1/work/my-issues', myIssuesSchema, { query: { limit } }),
  };
}

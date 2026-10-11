import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';
import {
  codeLinksResponseSchema,
  codeTransitionsSchema,
  updateCodeTransitionsBodySchema,
  type UpdateCodeTransitionsBody,
} from '../../../shared/index.ts';

const BASE = '/api/v1/work';

/** The issue's Development section and the project's moves when linked work changes. */
export function workCodeLinkEndpoints(http: Http) {
  const transitions = (projectKey: string) =>
    `${BASE}/projects/${enc(projectKey)}/code-transitions`;
  return {
    codeLinks: {
      list: async (key: string) =>
        (await http.request(`${BASE}/issues/${enc(key)}/code-links`, codeLinksResponseSchema))
          .items,
      transitions: async (projectKey: string) =>
        http.request(transitions(projectKey), codeTransitionsSchema),
      updateTransitions: async (projectKey: string, body: UpdateCodeTransitionsBody) =>
        http.request(transitions(projectKey), codeTransitionsSchema, {
          method: 'PUT',
          body: validated(updateCodeTransitionsBodySchema, body),
        }),
    },
  };
}

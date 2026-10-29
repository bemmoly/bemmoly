import type { Http } from '@bemmoly/api-client';
import {
  variableSchema,
  variablesResponseSchema,
  type SetVariableBody,
} from '@bemmoly/module-pipelines/shared';

const base = '/api/v1/pipelines/applications';

/** Under the application's own key, so a deploy's refresh of the page refreshes them too. */
export const variablesKeys = {
  list: (application: string) => ['pipelines', 'application', application, 'variables'] as const,
};

/** One variable: for one environment when `environment` is set, for every one otherwise. */
export interface VariableAt {
  application: string;
  environment: string | null;
  name: string;
}

const pathOf = (at: VariableAt) =>
  `${base}/${encodeURIComponent(at.application)}/variables/${encodeURIComponent(at.name)}`;

const queryOf = (at: VariableAt) => (at.environment ? { environment: at.environment } : {});

/** An application's variables. A secret's value is sent once, to set it, and never comes back. */
export function variablesEndpoints(http: Http) {
  return {
    list: (application: string) =>
      http.request(`${base}/${encodeURIComponent(application)}/variables`, variablesResponseSchema),
    set: (at: VariableAt, body: SetVariableBody) =>
      http.request(pathOf(at), variableSchema, { method: 'PUT', body, query: queryOf(at) }),
    remove: (at: VariableAt) => http.send(pathOf(at), { method: 'DELETE', query: queryOf(at) }),
  };
}

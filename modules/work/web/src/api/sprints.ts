import {
  completeSprintBodySchema,
  createSprintBodySchema,
  sprintSchema,
  startSprintBodySchema,
  updateSprintBodySchema,
  type CompleteSprintBody,
  type CreateSprintBody,
  type StartSprintBody,
  type UpdateSprintBody,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

const BASE = '/api/v1/work';

/**
 * Planning a sprint from the Backlog: create, edit, drop a future one, start
 * and complete. Listing sprints is the Board's call in boards.ts.
 */
export function workSprintEndpoints(http: Http) {
  return {
    sprintPlanning: {
      create: async (projectKey: string, body: CreateSprintBody) =>
        http.request(`${BASE}/projects/${enc(projectKey)}/sprints`, sprintSchema, {
          method: 'POST',
          body: validated(createSprintBodySchema, body),
        }),
      update: async (id: string, body: UpdateSprintBody) =>
        http.request(`${BASE}/sprints/${enc(id)}`, sprintSchema, {
          method: 'PATCH',
          body: validated(updateSprintBodySchema, body),
        }),
      /** Only a sprint that has not started; its issues return to the backlog. */
      remove: async (id: string) => http.send(`${BASE}/sprints/${enc(id)}`, { method: 'DELETE' }),
      start: async (id: string, body: StartSprintBody = {}) =>
        http.request(`${BASE}/sprints/${enc(id)}/start`, sprintSchema, {
          method: 'POST',
          body: validated(startSprintBodySchema, body),
        }),
      complete: async (id: string, body: CompleteSprintBody) =>
        http.request(`${BASE}/sprints/${enc(id)}/complete`, sprintSchema, {
          method: 'POST',
          body: validated(completeSprintBodySchema, body),
        }),
    },
  };
}

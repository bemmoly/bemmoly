import {
  boardSchema,
  boardsResponseSchema,
  boardViewQuerySchema,
  boardViewSchema,
  listProjectsQuerySchema,
  projectsPageSchema,
  sprintsResponseSchema,
  updateBoardBodySchema,
  workflowsResponseSchema,
  type BoardViewQuery,
  type ListProjectsQuery as ListProjectsOutput,
  type UpdateBoardBody,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';
import type { ListOptions } from '@bemmoly/api-client';

export type ProjectsFilter = Partial<
  Pick<ListProjectsOutput, 'cursor' | 'limit' | 'teamId' | 'archived'>
>;

const BASE = '/api/v1/work';

/** The Board screen's reads: projects, boards and the one-call view, plus the config write. */
export function workBoardsEndpoints(http: Http) {
  return {
    projects: {
      list: async (filter: ProjectsFilter = {}) =>
        http.request(`${BASE}/projects`, projectsPageSchema, {
          query: validated(listProjectsQuerySchema, filter),
        }),
    },
    boards: {
      list: async (projectId: string) =>
        http.request(`${BASE}/projects/${enc(projectId)}/boards`, boardsResponseSchema),
      get: async (id: string) => http.request(`${BASE}/boards/${enc(id)}`, boardSchema),
      update: async (id: string, body: UpdateBoardBody) =>
        http.request(`${BASE}/boards/${enc(id)}`, boardSchema, {
          method: 'PATCH',
          body: validated(updateBoardBodySchema, body),
        }),
      /** Columns, lanes, cards, counts and WIP state in one call; the board never fans out. */
      view: async (id: string, query: BoardViewQuery = {}, options: ListOptions = {}) =>
        http.request(`${BASE}/boards/${enc(id)}/view`, boardViewSchema, {
          query: validated(boardViewQuerySchema, query),
          ...options,
        }),
    },
    sprints: {
      list: async (projectId: string) =>
        http.request(`${BASE}/projects/${enc(projectId)}/sprints`, sprintsResponseSchema),
    },
    workflows: {
      list: async (projectId: string) =>
        http.request(`${BASE}/projects/${enc(projectId)}/workflows`, workflowsResponseSchema),
    },
  };
}

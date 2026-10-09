import {
  boardMetricsSchema,
  boardSchema,
  boardsResponseSchema,
  boardViewQuerySchema,
  boardViewSchema,
  listProjectsQuerySchema,
  listSprintsQuerySchema,
  projectsPageSchema,
  sprintsResponseSchema,
  updateBoardBodySchema,
  workflowsResponseSchema,
  type BoardViewQuery,
  type ListProjectsQuery as ListProjectsOutput,
  type ListSprintsQuery,
  type UpdateBoardBody,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';
import type { ListOptions } from '@bemmoly/api-client';

export type ProjectsFilter = Partial<
  Pick<ListProjectsOutput, 'cursor' | 'limit' | 'teamId' | 'archived'>
>;

const BASE = '/api/v1/work';

/** The Board screen's reads: projects, boards, the one-call view and metrics, plus the config write. */
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
      /** Velocity, burndown, cycle time and throughput, cached on the server per board. */
      metrics: async (id: string) =>
        http.request(`${BASE}/boards/${enc(id)}/metrics`, boardMetricsSchema),
    },
    sprints: {
      list: async (projectId: string, query: Partial<ListSprintsQuery> = {}) =>
        http.request(`${BASE}/projects/${enc(projectId)}/sprints`, sprintsResponseSchema, {
          query: validated(listSprintsQuerySchema, query),
        }),
    },
    /** The workflows a project uses; the board reads status names from them. */
    projectWorkflows: {
      list: async (projectId: string) =>
        (await http.request(`${BASE}/workflows`, workflowsResponseSchema, { query: { projectId } }))
          .items,
    },
  };
}

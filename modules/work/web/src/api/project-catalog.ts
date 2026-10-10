import {
  createProjectBodySchema,
  fieldsResponseSchema,
  issueTypeFieldsResponseSchema,
  issueTypesResponseSchema,
  labelsResponseSchema,
  listProjectsQuerySchema,
  projectSchema,
  projectsPageSchema,
  sprintsResponseSchema,
  versionsResponseSchema,
  workflowsResponseSchema,
  type CreateProjectBody,
  type ListProjectsQuery,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

const BASE = '/api/v1/work';

/**
 * Projects and the vocabulary a project's issues are written in: types, fields, the create
 * form layout of a type, statuses, labels, versions and sprints. Project routes take the key
 * ("PLT"), as the server's do; the workflow list filters by project id.
 */
export function workProjectCatalogEndpoints(http: Http) {
  const project = (key: string, rest: string) => `${BASE}/projects/${enc(key)}${rest}`;
  return {
    projectCatalog: {
      list: async (query: Partial<ListProjectsQuery> = {}) =>
        http.request(`${BASE}/projects`, projectsPageSchema, {
          query: validated(listProjectsQuerySchema, query),
        }),
      create: async (body: CreateProjectBody) =>
        http.request(`${BASE}/projects`, projectSchema, {
          method: 'POST',
          body: validated(createProjectBodySchema, body),
          idempotent: true,
        }),
      /** Archived projects leave every list but keep their issues; unarchive brings them back. */
      archive: async (key: string) =>
        http.request(project(key, '/archive'), projectSchema, { method: 'POST' }),
      unarchive: async (key: string) =>
        http.request(project(key, '/unarchive'), projectSchema, { method: 'POST' }),
      issueTypes: async (key: string) =>
        (await http.request(project(key, '/issue-types'), issueTypesResponseSchema)).items,
      fields: async (key: string) =>
        (await http.request(project(key, '/fields'), fieldsResponseSchema)).items,
      /** The create form of one type: which fields, in which order, which are required. */
      layout: async (key: string, typeId: string) =>
        (
          await http.request(
            project(key, `/issue-types/${enc(typeId)}/fields`),
            issueTypeFieldsResponseSchema,
          )
        ).items,
      workflows: async (projectId: string) =>
        (
          await http.request(`${BASE}/workflows`, workflowsResponseSchema, {
            query: { projectId },
          })
        ).items,
      labels: async (key: string) =>
        (await http.request(project(key, '/labels'), labelsResponseSchema)).items,
      versions: async (key: string) =>
        (await http.request(project(key, '/versions'), versionsResponseSchema)).items,
      sprints: async (key: string) =>
        (await http.request(project(key, '/sprints'), sprintsResponseSchema)).items,
    },
  };
}

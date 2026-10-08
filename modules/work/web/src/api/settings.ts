import {
  boardSchema,
  boardsResponseSchema,
  createFieldBodySchema,
  createIssueTypeBodySchema,
  fieldSchema,
  fieldsResponseSchema,
  issueTypeFieldsResponseSchema,
  issueTypeSchema,
  issueTypesResponseSchema,
  projectSchema,
  putIssueTypeFieldsBodySchema,
  schemeDiffSchema,
  schemesResponseSchema,
  updateBoardBodySchema,
  updateFieldBodySchema,
  updateIssueTypeBodySchema,
  updateProjectBodySchema,
  type CreateFieldBody,
  type CreateIssueTypeBody,
  type PutIssueTypeFieldsBody,
  type SchemeKind,
  type UpdateBoardBody,
  type UpdateFieldBody,
  type UpdateIssueTypeBody,
  type UpdateProjectBody,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

const base = '/api/v1/work';

/** Query keys for the project settings screens; `project` is the root for one project. */
export const workSettingsKeys = {
  project: (projectId: string) => ['work', 'project', projectId] as const,
  byKey: (key: string) => ['work', 'project-key', key] as const,
  schemes: (projectId: string) => ['work', 'project', projectId, 'schemes'] as const,
  schemeDiff: (projectId: string, kind: SchemeKind) =>
    ['work', 'project', projectId, 'schemes', kind, 'diff'] as const,
  boards: (projectId: string) => ['work', 'project', projectId, 'boards'] as const,
  issueTypes: (projectId: string) => ['work', 'project', projectId, 'issue-types'] as const,
  fields: (projectId: string) => ['work', 'project', projectId, 'fields'] as const,
  typeFields: (issueTypeId: string) => ['work', 'issue-type', issueTypeId, 'fields'] as const,
};

/**
 * /api/v1/work: projects, their schemes, boards, issue types and fields, as
 * the Board Settings and Workflow mocks edit them. Project copies carry an
 * originId; the scheme calls switch between inheriting and overriding.
 */
export function workSettingsEndpoints(http: Http) {
  return {
    projects: {
      get: async (projectId: string) =>
        http.request(`${base}/projects/${enc(projectId)}`, projectSchema),
      /** "PLT" in the URL; the settings pages are reached by key. */
      getByKey: async (key: string) =>
        http.request(`${base}/projects/by-key/${enc(key)}`, projectSchema),
      update: async (projectId: string, body: UpdateProjectBody) =>
        http.request(`${base}/projects/${enc(projectId)}`, projectSchema, {
          method: 'PATCH',
          body: validated(updateProjectBodySchema, body),
        }),
    },
    schemes: {
      list: async (projectId: string) =>
        http.request(`${base}/projects/${enc(projectId)}/schemes`, schemesResponseSchema),
      diff: async (projectId: string, kind: SchemeKind) =>
        http.request(`${base}/projects/${enc(projectId)}/schemes/${kind}/diff`, schemeDiffSchema),
      /** Copies the org default into the project so it can be edited. */
      override: async (projectId: string, kind: SchemeKind) =>
        http.send(`${base}/projects/${enc(projectId)}/schemes/${kind}/override`, {
          method: 'POST',
        }),
      /** Drops the project copy and inherits the org default again. */
      reset: async (projectId: string, kind: SchemeKind) =>
        http.send(`${base}/projects/${enc(projectId)}/schemes/${kind}/reset`, {
          method: 'POST',
        }),
    },
    boards: {
      list: async (projectId: string) =>
        (await http.request(`${base}/projects/${enc(projectId)}/boards`, boardsResponseSchema))
          .items,
      update: async (boardId: string, body: UpdateBoardBody) =>
        http.request(`${base}/boards/${enc(boardId)}`, boardSchema, {
          method: 'PATCH',
          body: validated(updateBoardBodySchema, body),
        }),
    },
    issueTypes: {
      list: async (projectId: string) =>
        (
          await http.request(
            `${base}/projects/${enc(projectId)}/issue-types`,
            issueTypesResponseSchema,
          )
        ).items,
      create: async (projectId: string, body: CreateIssueTypeBody) =>
        http.request(`${base}/projects/${enc(projectId)}/issue-types`, issueTypeSchema, {
          method: 'POST',
          body: validated(createIssueTypeBodySchema, body),
          idempotent: true,
        }),
      update: async (issueTypeId: string, body: UpdateIssueTypeBody) =>
        http.request(`${base}/issue-types/${enc(issueTypeId)}`, issueTypeSchema, {
          method: 'PATCH',
          body: validated(updateIssueTypeBodySchema, body),
        }),
      fields: async (issueTypeId: string) =>
        (
          await http.request(
            `${base}/issue-types/${enc(issueTypeId)}/fields`,
            issueTypeFieldsResponseSchema,
          )
        ).items,
      /** Replaces the create-form layout: order, required and on-card flags. */
      putFields: async (issueTypeId: string, body: PutIssueTypeFieldsBody) =>
        (
          await http.request(
            `${base}/issue-types/${enc(issueTypeId)}/fields`,
            issueTypeFieldsResponseSchema,
            { method: 'PUT', body: validated(putIssueTypeFieldsBodySchema, body) },
          )
        ).items,
    },
    fields: {
      list: async (projectId: string) =>
        (await http.request(`${base}/projects/${enc(projectId)}/fields`, fieldsResponseSchema))
          .items,
      create: async (projectId: string, body: CreateFieldBody) =>
        http.request(`${base}/projects/${enc(projectId)}/fields`, fieldSchema, {
          method: 'POST',
          body: validated(createFieldBodySchema, body),
          idempotent: true,
        }),
      update: async (fieldId: string, body: UpdateFieldBody) =>
        http.request(`${base}/fields/${enc(fieldId)}`, fieldSchema, {
          method: 'PATCH',
          body: validated(updateFieldBodySchema, body),
        }),
    },
  };
}

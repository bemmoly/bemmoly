import {
  addProjectMembersBodySchema,
  addProjectMembersResponseSchema,
  projectMemberSchema,
  projectMembersResponseSchema,
  projectPermissionsSchema,
  updateProjectMemberBodySchema,
  type AddProjectMembersBody,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

const base = '/api/v1/work';

export const workMembersKeys = {
  /** Under the project's key so a project's realtime events refetch its members too. */
  list: (projectKey: string) => ['work', 'project-members', projectKey] as const,
  /** Beside the members: a role change refetches both. */
  permissions: (projectKey: string) =>
    ['work', 'project-members', projectKey, 'permissions'] as const,
};

/** /api/v1/work/projects/:key/members and …/permissions: who is on a project, and what I may do. */
export function workMembersEndpoints(http: Http) {
  const path = (projectKey: string) => `${base}/projects/${enc(projectKey)}/members`;
  return {
    list: async (projectKey: string) =>
      http.request(path(projectKey), projectMembersResponseSchema),
    /** The Work actions the signed-in person holds in the project. */
    permissions: async (projectKey: string) =>
      http.request(`${base}/projects/${enc(projectKey)}/permissions`, projectPermissionsSchema),
    add: async (projectKey: string, body: AddProjectMembersBody) =>
      (
        await http.request(path(projectKey), addProjectMembersResponseSchema, {
          method: 'POST',
          body: validated(addProjectMembersBodySchema, body),
        })
      ).items,
    setRole: async (projectKey: string, userId: string, roleId: string) =>
      http.request(`${path(projectKey)}/${enc(userId)}`, projectMemberSchema, {
        method: 'PATCH',
        body: validated(updateProjectMemberBodySchema, { roleId }),
      }),
    remove: async (projectKey: string, userId: string) =>
      http.send(`${path(projectKey)}/${enc(userId)}`, { method: 'DELETE' }),
  };
}

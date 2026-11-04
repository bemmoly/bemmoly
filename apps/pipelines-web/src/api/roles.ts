import type { Http } from '@bemmoly/api-client';
import { rolesResponseSchema } from '@bemmoly/shared';
import {
  approvalGroupSchema,
  approvalGroupsResponseSchema,
  invitePeopleResponseSchema,
  peopleResponseSchema,
  pipelinesMeSchema,
  pipelinesPersonSchema,
  ROLES_PATHS,
  type AddGroupMembersBody,
  type CreateApprovalGroupBody,
  type InvitePeopleBody,
  type PersonRole,
  type UpdateApprovalGroupBody,
} from '@bemmoly/module-pipelines/shared';

/** Roles, people and approval groups. */
export const rolesKeys = {
  all: ['pipelines', 'roles'] as const,
  me: () => ['pipelines', 'roles', 'me'] as const,
  people: () => ['pipelines', 'roles', 'people'] as const,
  groups: () => ['pipelines', 'roles', 'groups'] as const,
};

export function rolesEndpoints(http: Http) {
  return {
    me: () => http.request(ROLES_PATHS.me, pipelinesMeSchema),
    /** The workspace's roles, for the account a new person is invited with (the kernel's
     * `roles` endpoints sit under this name's shadow in the app's client). */
    workspaceRoles: () => http.request('/api/v1/roles', rolesResponseSchema),
    people: () => http.request(ROLES_PATHS.people, peopleResponseSchema),
    setRole: (userId: string, role: PersonRole) =>
      http.request(ROLES_PATHS.person(userId), pipelinesPersonSchema, {
        method: 'PUT',
        body: { role },
      }),
    removePerson: (userId: string) => http.send(ROLES_PATHS.person(userId), { method: 'DELETE' }),
    invite: (body: InvitePeopleBody) =>
      http.request(ROLES_PATHS.invitations, invitePeopleResponseSchema, {
        method: 'POST',
        body,
      }),
    revokeInvitation: (id: string) => http.send(ROLES_PATHS.invitation(id), { method: 'DELETE' }),
    groups: () => http.request(ROLES_PATHS.groups, approvalGroupsResponseSchema),
    createGroup: (body: CreateApprovalGroupBody) =>
      http.request(ROLES_PATHS.groups, approvalGroupSchema, { method: 'POST', body }),
    updateGroup: (id: string, body: UpdateApprovalGroupBody) =>
      http.request(ROLES_PATHS.group(id), approvalGroupSchema, { method: 'PATCH', body }),
    removeGroup: (id: string) => http.send(ROLES_PATHS.group(id), { method: 'DELETE' }),
    addMembers: (id: string, body: AddGroupMembersBody) =>
      http.request(ROLES_PATHS.groupMembers(id), approvalGroupSchema, { method: 'POST', body }),
    removeMember: (id: string, userId: string) =>
      http.send(ROLES_PATHS.groupMember(id, userId), { method: 'DELETE' }),
  };
}

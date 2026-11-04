import type {
  CreateApprovalGroupBody,
  PersonRole,
  UpdateApprovalGroupBody,
} from '@bemmoly/module-pipelines/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rolesKeys } from '../api/roles.ts';
import { api } from '../lib/api.ts';

/** The person's Pipelines role and the places it shows; changes only when an admin acts. */
export const pipelinesMeQuery = queryOptions({
  queryKey: rolesKeys.me(),
  queryFn: () => api.roles.me(),
  staleTime: 60_000,
});

export function usePipelinesMe() {
  return useQuery(pipelinesMeQuery);
}

/**
 * Whether the person may change anything: false for a Viewer (and anyone without a role),
 * so screens hide the actions the server would refuse anyway.
 */
export function useCanChange(): boolean {
  const { data } = usePipelinesMe();
  return data ? !data.readOnly : false;
}

export function usePeople(enabled = true) {
  return useQuery({ queryKey: rolesKeys.people(), queryFn: () => api.roles.people(), enabled });
}

export function useApprovalGroups(enabled = true) {
  return useQuery({ queryKey: rolesKeys.groups(), queryFn: () => api.roles.groups(), enabled });
}

/** Every write here can change someone's role or groups: refetch all of it, /me included. */
export function useRoleWrites() {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: rolesKeys.all });
  return {
    setRole: useMutation({
      mutationFn: ({ userId, role }: { userId: string; role: PersonRole }) =>
        api.roles.setRole(userId, role),
      onSettled: settle,
    }),
    removePerson: useMutation({
      mutationFn: (userId: string) => api.roles.removePerson(userId),
      onSettled: settle,
    }),
    revokeInvitation: useMutation({
      mutationFn: (id: string) => api.roles.revokeInvitation(id),
      onSettled: settle,
    }),
    createGroup: useMutation({
      mutationFn: (body: CreateApprovalGroupBody) => api.roles.createGroup(body),
      onSettled: settle,
    }),
    updateGroup: useMutation({
      mutationFn: ({ id, body }: { id: string; body: UpdateApprovalGroupBody }) =>
        api.roles.updateGroup(id, body),
      onSettled: settle,
    }),
    removeGroup: useMutation({
      mutationFn: (id: string) => api.roles.removeGroup(id),
      onSettled: settle,
    }),
    addMembers: useMutation({
      mutationFn: ({ id, users }: { id: string; users: string[] }) =>
        api.roles.addMembers(id, { users }),
      onSettled: settle,
    }),
    removeMember: useMutation({
      mutationFn: ({ id, userId }: { id: string; userId: string }) =>
        api.roles.removeMember(id, userId),
      onSettled: settle,
    }),
  };
}

import type {
  AddProjectMembersBody,
  ProjectMember,
  ProjectRole,
} from '@bemmoly/module-work/shared';
import type { LoadOptions, SelectOption } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { workMembersKeys } from '../api/index.ts';
import { usePeople } from '../hooks/issue-people.ts';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';

/** Where a project's members screen lives. */
export const membersPath = (projectKey: string) => `/work/members/${projectKey}`;

const PROJECT_ADMIN = 'project_admin';

/** Every role of the roles matrix, in its order; inside the project it replaces the org role. */
export const roleOptions = (roles: readonly ProjectRole[]): SelectOption[] =>
  roles.map((role) => ({ value: role.id, label: role.name }));

/**
 * A project's members with the changes the screen makes. Every change
 * refetches the members and the project list, since adding or removing
 * someone changes which projects they see.
 */
export function useProjectMembers(projectKey: string | undefined) {
  const queryClient = useQueryClient();
  const key = projectKey ?? '';
  const list = useQuery({
    queryKey: workMembersKeys.list(key),
    queryFn: () => api.work.members.list(key),
    enabled: Boolean(projectKey),
  });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: workMembersKeys.list(key) }),
      queryClient.invalidateQueries({ queryKey: workKeys.projects() }),
    ]);
  const add = useMutation({
    mutationFn: (body: AddProjectMembersBody) => api.work.members.add(key, body),
    onSettled: refresh,
  });
  const setRole = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      api.work.members.setRole(key, userId, roleId),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (member: ProjectMember) => api.work.members.remove(key, member.userId),
    onSettled: refresh,
  });
  const members = useMemo(() => list.data?.items ?? [], [list.data]);
  const admins = members.filter((member) => member.roleKey === PROJECT_ADMIN);
  /** The one project admin left cannot be removed or demoted; the server refuses it too. */
  const isLastAdmin = (member: ProjectMember) =>
    member.roleKey === PROJECT_ADMIN && admins.length === 1;
  return {
    list,
    members,
    roles: list.data?.roles ?? [],
    canManage: list.data?.canManage ?? false,
    isLastAdmin,
    add,
    setRole,
    remove,
  };
}

export type ProjectMembers = ReturnType<typeof useProjectMembers>;

/** The members table's search box: by name or email, on the loaded list. */
export function useMemberFilter(members: readonly ProjectMember[]) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const rows = needle
    ? members.filter(
        (member) =>
          member.name.toLowerCase().includes(needle) || member.email.toLowerCase().includes(needle),
      )
    : members;
  return { query, setQuery, rows };
}

/** Server search for people to add, leaving out who is already on the project. */
export function usePeopleToAdd(members: readonly ProjectMember[]): LoadOptions {
  const { loadOptions } = usePeople();
  const taken = useMemo(() => new Set(members.map((member) => member.userId)), [members]);
  return useCallback<LoadOptions>(
    async (query, signal) =>
      (await loadOptions(query, signal)).filter((option) => !taken.has(option.value)),
    [loadOptions, taken],
  );
}

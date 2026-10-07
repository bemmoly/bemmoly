import { queryKeys } from '@bemmoly/api-client';
import type { Role } from '@bemmoly/shared';
import { queryOptions } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { useMe } from './use-session.ts';

/** Every change on the People pages (roles, teams, invitations, module access) needs this. */
export const PEOPLE_CAPABILITY = 'workspace.roles.manage';

export const NO_PEOPLE_ACCESS =
  'Changing people needs the "Manage org roles" capability. Ask an org admin.';

/** Org admin always holds every capability; its matrix column is read-only. */
export const ORG_ADMIN_KEY = 'org_admin';

export const rolesQuery = queryOptions({
  queryKey: queryKeys.roles(),
  queryFn: () => api.roles.list(),
});

export const teamsQuery = queryOptions({
  queryKey: queryKeys.teams.all(),
  queryFn: () => api.teams.list(),
});

export const invitationsQuery = queryOptions({
  queryKey: queryKeys.invitations(),
  queryFn: () => api.invitations.list(),
});

export const grantsQuery = queryOptions({
  queryKey: queryKeys.moduleGrants(),
  queryFn: () => api.moduleGrants.list(),
});

export const capabilitiesQuery = queryOptions({
  queryKey: queryKeys.capabilities(),
  queryFn: () => api.capabilities(),
});

export function useCanManagePeople(): boolean {
  return useMe().can(PEOPLE_CAPABILITY);
}

export function roleOptions(roles: readonly Role[]) {
  return roles.map((role) => ({ value: role.id, label: role.name }));
}

import { queryKeys } from '@bemmoly/api-client';
import {
  createTeamSchema,
  type ModuleGrant,
  type Role,
  type Team,
  type TeamMember,
  type User,
} from '@bemmoly/shared';
import { avatarHue, initialsOf, type StackPerson } from '@bemmoly/ui';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api.ts';
import { describeError, serverFieldErrors, validateForm, type FieldErrors } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import { useDirectory } from './use-directory.ts';
import { moduleLabel } from './use-module-access.ts';
import { useModules } from './use-modules.ts';
import {
  grantsQuery,
  rolesQuery,
  roleOptions,
  teamsQuery,
  useCanManagePeople,
} from './use-people.ts';
import { defaultRoleId } from './use-setup-invites.ts';
import { userOption, useUserSearch } from './use-user-search.ts';

export interface TeamCardView {
  id: string;
  name: string;
  /** The team's own colour, stored as data; null falls back to the accent. */
  color: string | null;
  initials: string;
  lead: string;
  /** The lead as a person to draw, or null while the team has none. */
  leadPerson: StackPerson | null;
  memberCount: number;
  defaultRole: string;
  /** The modules this team's grants open, by name. */
  modules: string[];
  people: StackPerson[];
}

/** A team row's facts, joining members and the lead with the directory. */
export function teamCard(
  team: Team,
  members: readonly TeamMember[],
  people: ReadonlyMap<string, User>,
  roles: readonly Role[],
  modules: string[] = [],
): TeamCardView {
  const lead = team.leadUserId ? people.get(team.leadUserId) : undefined;
  return {
    id: team.id,
    name: team.name,
    color: team.color,
    initials: initialsOf(team.name),
    lead: lead?.name || 'nobody yet',
    leadPerson: lead ? { id: lead.id, name: lead.name, hue: avatarHue(lead.id) } : null,
    memberCount: team.memberCount,
    defaultRole: roles.find((role) => role.id === team.defaultRoleId)?.name ?? 'None',
    modules,
    people: members.flatMap((member) => {
      const user = people.get(member.userId);
      return user ? [{ id: user.id, name: user.name, hue: avatarHue(user.id) }] : [];
    }),
  };
}

/** The Teams page: one row per team with its lead, members, modules and default role. */
export function useTeams() {
  const canManage = useCanManagePeople();
  const teams = useQuery(teamsQuery);
  const roles = useQuery(rolesQuery).data?.items ?? [];
  const grants = useQuery(grantsQuery).data?.items ?? [];
  const manifests = useModules().data;
  const { directory } = useDirectory();
  const items = teams.data?.items ?? [];
  const members = useQueries({
    queries: items.map((team) => ({
      queryKey: queryKeys.teams.members(team.id),
      queryFn: () => api.teams.members(team.id),
    })),
  });
  const cards = items.map((team, index) =>
    teamCard(
      team,
      members[index]?.data?.items ?? [],
      directory.byId,
      roles,
      modulesForTeam(team.id, grants).map((id) => moduleLabel(id, manifests)),
    ),
  );
  return { canManage, query: teams, cards };
}

/** The module ids a team's members can open through a grant to the team or to everyone. */
export function modulesForTeam(teamId: string, grants: readonly ModuleGrant[]): string[] {
  const ids = new Set(
    grants
      .filter(
        (grant) =>
          grant.subjectKind === 'everyone' ||
          (grant.subjectKind === 'team' && grant.subjectId === teamId),
      )
      .map((grant) => grant.moduleId),
  );
  return [...ids].sort();
}

/**
 * "Delete team": irreversible (memberships and grants go with it), so it asks for the team's
 * name first and then removes the row at once.
 */
export function useDeleteTeam(onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (team: TeamCardView) => api.teams.remove(team.id),
    onSuccess: async (_, team) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() });
      toast(`${team.name} deleted`);
      onDone();
    },
  });
}

interface TeamForm {
  name: string;
  leadUserId: string;
  defaultRoleId: string;
}

const EMPTY: TeamForm = { name: '', leadUserId: '', defaultRoleId: '' };

/** "Create team": a name, an optional lead from the directory and the role new members get. */
export function useCreateTeam(onDone: () => void) {
  const queryClient = useQueryClient();
  const roles = useQuery(rolesQuery).data?.items ?? [];
  const { directory } = useDirectory();
  const searchLeads = useUserSearch({ status: 'active' });
  const [form, setForm] = useState<TeamForm>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const roleId = form.defaultRoleId || defaultRoleId(roles) || '';

  const mutation = useMutation({
    mutationFn: (body: {
      name: string;
      leadUserId?: string | null;
      defaultRoleId?: string | null;
    }) => api.teams.create(body),
    onSuccess: async (team) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() });
      toast(`${team.name} created`);
      setForm(EMPTY);
      onDone();
    },
    onError: (error) => {
      const fields = serverFieldErrors(error);
      setErrors({ name: fields['name'] ?? describeError(error).message });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateForm(createTeamSchema, {
      name: form.name,
      leadUserId: form.leadUserId || null,
      defaultRoleId: roleId || null,
    });
    if (result.errors) return setErrors(result.errors);
    setErrors({});
    mutation.mutate(result.data);
  };

  return {
    form: { ...form, defaultRoleId: roleId },
    update: (patch: Partial<TeamForm>) => setForm((current) => ({ ...current, ...patch })),
    errors,
    submit,
    mutation,
    reset: () => {
      setForm(EMPTY);
      setErrors({});
    },
    leadOptions: [
      { value: '', label: 'No lead yet' },
      ...directory.users.filter((user) => user.status === 'active').map(userOption),
    ],
    searchLeads,
    roleOptions: roleOptions(roles),
  };
}

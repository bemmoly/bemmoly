import { queryKeys } from '@bemmoly/api-client';
import {
  createTeamSchema,
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
import { rolesQuery, roleOptions, teamsQuery, useCanManagePeople } from './use-people.ts';
import { defaultRoleId } from './use-setup-invites.ts';

export interface TeamCardView {
  id: string;
  name: string;
  /** The team's own colour, stored as data; null falls back to the accent. */
  color: string | null;
  initials: string;
  lead: string;
  memberCount: number;
  defaultRole: string;
  people: StackPerson[];
}

/** A team card's facts, joining members and the lead with the directory. */
export function teamCard(
  team: Team,
  members: readonly TeamMember[],
  people: ReadonlyMap<string, User>,
  roles: readonly Role[],
): TeamCardView {
  return {
    id: team.id,
    name: team.name,
    color: team.color,
    initials: initialsOf(team.name),
    lead: (team.leadUserId && people.get(team.leadUserId)?.name) || 'nobody yet',
    memberCount: team.memberCount,
    defaultRole: roles.find((role) => role.id === team.defaultRoleId)?.name ?? 'None',
    people: members.flatMap((member) => {
      const user = people.get(member.userId);
      return user ? [{ id: user.id, name: user.name, hue: avatarHue(user.id) }] : [];
    }),
  };
}

/** The Teams page: one card per team with its lead, default role and members. */
export function useTeams() {
  const canManage = useCanManagePeople();
  const teams = useQuery(teamsQuery);
  const roles = useQuery(rolesQuery).data?.items ?? [];
  const { directory } = useDirectory();
  const items = teams.data?.items ?? [];
  const members = useQueries({
    queries: items.map((team) => ({
      queryKey: queryKeys.teams.members(team.id),
      queryFn: () => api.teams.members(team.id),
    })),
  });
  const cards = items.map((team, index) =>
    teamCard(team, members[index]?.data?.items ?? [], directory.byId, roles),
  );
  return { canManage, query: teams, cards };
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
      ...directory.users
        .filter((user) => user.status === 'active')
        .map((user) => ({ value: user.id, label: user.name })),
    ],
    roleOptions: roleOptions(roles),
  };
}

import { isApiError, queryKeys } from '@bemmoly/api-client';
import {
  createTeamSchema,
  updateTeamSchema,
  type ModuleGrant,
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
import { grantsQuery, teamsQuery, useCanManagePeople } from './use-people.ts';
import { userOption, useUserSearch } from './use-user-search.ts';

export interface TeamCardView {
  id: string;
  name: string;
  /** The team's own colour, stored as data; null falls back to the accent. */
  color: string | null;
  initials: string;
  leadUserId: string | null;
  lead: string;
  /** The lead as a person to draw, or null while the team has none. */
  leadPerson: StackPerson | null;
  memberCount: number;
  /** The modules this team's grants open, by name. */
  modules: string[];
  people: StackPerson[];
}

/** A team row's facts, joining members and the lead with the directory. */
export function teamCard(
  team: Team,
  members: readonly TeamMember[],
  people: ReadonlyMap<string, User>,
  modules: string[] = [],
): TeamCardView {
  const lead = team.leadUserId ? people.get(team.leadUserId) : undefined;
  return {
    id: team.id,
    name: team.name,
    color: team.color,
    initials: initialsOf(team.name),
    leadUserId: team.leadUserId,
    lead: lead?.name || 'nobody yet',
    leadPerson: lead ? { id: lead.id, name: lead.name, hue: avatarHue(lead.id) } : null,
    memberCount: team.memberCount,
    modules,
    people: members.flatMap((member) => {
      const user = people.get(member.userId);
      return user ? [{ id: user.id, name: user.name, hue: avatarHue(user.id) }] : [];
    }),
  };
}

/** The Teams page: one row per team with its lead, members and modules. */
export function useTeams() {
  const canManage = useCanManagePeople();
  const teams = useQuery(teamsQuery);
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
}

const EMPTY: TeamForm = { name: '', leadUserId: '' };

/** Field messages under their fields; a name clash stays under Name; the rest form-level. */
function teamFormErrors(error: Error): FieldErrors {
  return isApiError(error) && error.code === 'conflict'
    ? { name: describeError(error).message }
    : serverFieldErrors(error);
}

/** The shared state of Create team and Edit team: a name and an optional lead. */
function useTeamForm(initial: TeamForm) {
  const { directory } = useDirectory();
  const searchLeads = useUserSearch({ status: 'active' });
  const [form, setForm] = useState<TeamForm>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  return {
    form,
    setForm,
    errors,
    setErrors,
    update: (patch: Partial<TeamForm>) => setForm((current) => ({ ...current, ...patch })),
    leadOptions: [
      { value: '', label: 'No lead yet' },
      ...directory.users.filter((user) => user.status === 'active').map(userOption),
    ],
    searchLeads,
  };
}

/** "Create team": a name and an optional lead, who joins the team as its first member. */
export function useCreateTeam(onDone: () => void) {
  const queryClient = useQueryClient();
  const state = useTeamForm(EMPTY);

  const mutation = useMutation({
    mutationFn: (body: { name: string; leadUserId?: string | null }) => api.teams.create(body),
    onSuccess: async (team) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() });
      toast(`${team.name} created`);
      state.setForm(EMPTY);
      onDone();
    },
    onError: (error) => state.setErrors(teamFormErrors(error)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateForm(createTeamSchema, {
      name: state.form.name,
      leadUserId: state.form.leadUserId || null,
    });
    if (result.errors) return state.setErrors(result.errors);
    state.setErrors({});
    mutation.mutate(result.data);
  };

  return {
    form: state.form,
    update: state.update,
    errors: state.errors,
    submit,
    mutation,
    /** The failure that belongs to no field, for the form-level error. */
    formError: Object.keys(state.errors).length === 0 ? mutation.error : null,
    reset: () => {
      state.setForm(EMPTY);
      state.setErrors({});
      mutation.reset();
    },
    leadOptions: state.leadOptions,
    searchLeads: state.searchLeads,
  };
}

/** "Edit team": rename it or change its lead; only the fields that changed are sent. */
export function useEditTeam(team: TeamCardView, onDone: () => void) {
  const queryClient = useQueryClient();
  const initial = { name: team.name, leadUserId: team.leadUserId ?? '' };
  const state = useTeamForm(initial);

  const mutation = useMutation({
    mutationFn: (body: { name?: string; leadUserId?: string | null }) =>
      api.teams.update(team.id, body),
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.users.all() }),
      ]);
      toast(`${saved.name} saved`);
      onDone();
    },
    onError: (error) => state.setErrors(teamFormErrors(error)),
  });

  const changes = {
    ...(state.form.name.trim() !== team.name ? { name: state.form.name } : {}),
    ...(state.form.leadUserId !== initial.leadUserId
      ? { leadUserId: state.form.leadUserId || null }
      : {}),
  };
  const dirty = Object.keys(changes).length > 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!dirty) return onDone();
    const result = validateForm(updateTeamSchema, changes);
    if (result.errors) return state.setErrors(result.errors);
    state.setErrors({});
    mutation.mutate(result.data);
  };

  return {
    form: state.form,
    update: state.update,
    errors: state.errors,
    submit,
    mutation,
    dirty,
    formError: Object.keys(state.errors).length === 0 ? mutation.error : null,
    leadOptions: state.leadOptions,
    searchLeads: state.searchLeads,
  };
}

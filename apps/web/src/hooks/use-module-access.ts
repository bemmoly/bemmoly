import { queryKeys } from '@bemmoly/api-client';
import {
  createModuleGrantSchema,
  type ModuleGrant,
  type ModuleGrantSubjectKind,
  type ModuleManifest,
  type User,
} from '@bemmoly/shared';
import type { LoadOptions } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api.ts';
import { describeError, validateForm } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import { useDirectory } from './use-directory.ts';
import { useModules } from './use-modules.ts';
import { grantsQuery, rolesQuery, teamsQuery, useCanManagePeople } from './use-people.ts';
import { userOption, useUserSearch } from './use-user-search.ts';

type Subject = Pick<User, 'id' | 'roleId' | 'teamIds'>;

/** Whether one grant reaches this person: everyone, their team, their role or them. */
export function grantReaches(grant: ModuleGrant, user: Subject): boolean {
  switch (grant.subjectKind) {
    case 'everyone':
      return true;
    case 'team':
      return grant.subjectId !== null && user.teamIds.includes(grant.subjectId);
    case 'role':
      return grant.subjectId === user.roleId;
    case 'user':
      return grant.subjectId === user.id;
  }
}

/** The module ids a person can open, from the module grants (the Modules column). */
export function modulesForUser(user: Subject, grants: readonly ModuleGrant[]): string[] {
  const ids = new Set(grants.filter((grant) => grantReaches(grant, user)).map((g) => g.moduleId));
  return [...ids].sort();
}

/** A module's name from its top navigation entry, or its id when it has none. */
export function moduleLabel(id: string, manifests: readonly ModuleManifest[] = []): string {
  const manifest = manifests.find((entry) => entry.id === id);
  const entry = manifest?.navigation.find((nav) => nav.placement === 'top');
  return entry?.label ?? id.charAt(0).toUpperCase() + id.slice(1);
}

export interface SubjectNames {
  teams: ReadonlyMap<string, string>;
  roles: ReadonlyMap<string, string>;
  users: ReadonlyMap<string, string>;
}

const KIND_WORD: Record<ModuleGrantSubjectKind, string> = {
  everyone: 'Everyone',
  team: 'Team',
  role: 'Role',
  user: 'Person',
};

export const KIND_OPTIONS = (Object.keys(KIND_WORD) as ModuleGrantSubjectKind[]).map((kind) => ({
  value: kind,
  label: KIND_WORD[kind],
}));

/** "Everyone", "Team Platform", "Role Member", "Person Priya N.". */
export function grantLabel(grant: ModuleGrant, names: SubjectNames): string {
  if (grant.subjectKind === 'everyone') return KIND_WORD.everyone;
  const lookup = { team: names.teams, role: names.roles, user: names.users }[grant.subjectKind];
  const name = (grant.subjectId && lookup.get(grant.subjectId)) || 'removed';
  return `${KIND_WORD[grant.subjectKind]} ${name}`;
}

interface GrantDraft {
  kind: ModuleGrantSubjectKind;
  subjectId: string;
}

const NEW_GRANT: GrantDraft = { kind: 'team', subjectId: '' };

/** The per-module access editor: who may open each module, and adding or removing grants. */
export function useModuleAccess(enabled = true) {
  const queryClient = useQueryClient();
  const canManage = useCanManagePeople();
  const grants = useQuery({ ...grantsQuery, enabled });
  const manifests = useModules().data ?? [];
  const roles = useQuery({ ...rolesQuery, enabled }).data?.items ?? [];
  const teams = useQuery({ ...teamsQuery, enabled }).data?.items ?? [];
  const { directory } = useDirectory(enabled);
  const searchUsers = useUserSearch({ exclude: 'deactivated' });
  const [drafts, setDrafts] = useState<Record<string, GrantDraft>>({});
  const items = grants.data?.items ?? [];

  const names: SubjectNames = {
    teams: new Map(teams.map((team) => [team.id, team.name])),
    roles: new Map(roles.map((role) => [role.id, role.name])),
    users: new Map(directory.users.map((user) => [user.id, user.name])),
  };
  const moduleIds = [...new Set([...manifests.map((m) => m.id), ...items.map((g) => g.moduleId)])];
  const sections = moduleIds.sort().map((id) => ({
    id,
    label: moduleLabel(id, manifests),
    grants: items
      .filter((grant) => grant.moduleId === id)
      .map((grant) => ({ ...grant, label: grantLabel(grant, names) })),
  }));

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.moduleGrants() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.modules() }),
    ]);
  const onError = (error: unknown) => toast(describeError(error).message, 'danger');

  const add = useMutation({
    mutationFn: (body: {
      moduleId: string;
      subjectKind: ModuleGrantSubjectKind;
      subjectId?: string;
    }) => api.moduleGrants.create(body),
    onSuccess: async (grant) => {
      await refresh();
      setDrafts((current) => ({ ...current, [grant.moduleId]: NEW_GRANT }));
      toast(`Access to ${moduleLabel(grant.moduleId, manifests)} granted`);
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (grant: ModuleGrant) => api.moduleGrants.remove(grant.id),
    onSuccess: async (_, grant) => {
      await refresh();
      toast(`Access to ${moduleLabel(grant.moduleId, manifests)} removed`);
    },
    onError,
  });

  const draftFor = (moduleId: string) => drafts[moduleId] ?? NEW_GRANT;

  const takenBy = (moduleId: string, kind: ModuleGrantSubjectKind) =>
    new Set(
      items
        .filter((g) => g.moduleId === moduleId && g.subjectKind === kind)
        .map((g) => g.subjectId),
    );

  /** Subjects of this kind that do not hold a grant on the module yet. */
  const subjectOptions = (moduleId: string, kind: ModuleGrantSubjectKind) => {
    const taken = takenBy(moduleId, kind);
    const all =
      kind === 'team'
        ? teams.map((team) => ({ value: team.id, label: team.name }))
        : kind === 'role'
          ? roles.map((role) => ({ value: role.id, label: role.name }))
          : directory.users.filter((user) => user.status !== 'deactivated').map(userOption);
    return all.filter((option) => !taken.has(option.value));
  };

  /** People are searched on the server; teams and roles are few enough to filter here. */
  const searchSubjects = (
    moduleId: string,
    kind: ModuleGrantSubjectKind,
  ): LoadOptions | undefined =>
    kind === 'user'
      ? async (query, signal) => {
          const taken = takenBy(moduleId, kind);
          const found = await searchUsers(query, signal);
          return found.filter((option) => !taken.has(option.value));
        }
      : undefined;

  const everyoneGranted = (moduleId: string) =>
    items.some((g) => g.moduleId === moduleId && g.subjectKind === 'everyone');

  const submit = (moduleId: string) => {
    const draft = draftFor(moduleId);
    const result = validateForm(createModuleGrantSchema, {
      moduleId,
      subjectKind: draft.kind,
      ...(draft.kind === 'everyone' ? {} : { subjectId: draft.subjectId || undefined }),
    });
    if (result.errors) return toast('Choose who gets access first', 'danger');
    add.mutate(result.data);
  };

  return {
    query: grants,
    canManage,
    sections,
    draftFor,
    setDraft: (moduleId: string, patch: Partial<GrantDraft>) =>
      setDrafts((current) => {
        const next = { ...(current[moduleId] ?? NEW_GRANT), ...patch };
        if (patch.kind) next.subjectId = '';
        return { ...current, [moduleId]: next };
      }),
    subjectOptions,
    searchSubjects,
    everyoneGranted,
    submit,
    add,
    remove,
  };
}

import { queryKeys } from '@bemmoly/api-client';
import { USER_STATUSES, type User, type UserStatus } from '@bemmoly/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.ts';
import { useUiStore } from '../store/ui.ts';
import { invitationRows, matchesServerFilters } from './invited-rows.ts';
import { useDirectory } from './use-directory.ts';
import { moduleLabel, modulesForUser } from './use-module-access.ts';
import { useModules } from './use-modules.ts';
import {
  grantsQuery,
  invitationsQuery,
  rolesQuery,
  teamsQuery,
  useCanManagePeople,
} from './use-people.ts';

const PAGE = 50;
const SEARCH_DELAY = 250;
const LATE_AFTER = 7 * 86_400_000;

export interface UserFilters {
  q: string;
  roleId: string;
  teamId: string;
  status: UserStatus | '';
}

/** Role and team are filtered here; the server filters by text and status. */
export function matchesFilters(user: User, filters: Pick<UserFilters, 'roleId' | 'teamId'>) {
  return (
    (!filters.roleId || user.roleId === filters.roleId) &&
    (!filters.teamId || user.teamIds.includes(filters.teamId))
  );
}

/** Never seen, or not for more than a week: the mock paints these in the warning colour. */
export function isLate(lastSeenAt: string | null, now: Date = new Date()): boolean {
  return !lastSeenAt || now.getTime() - new Date(lastSeenAt).getTime() > LATE_AFTER;
}

const AUTH_LABEL: Record<UserStatus, string> = {
  active: 'Password',
  invited: 'Invited',
  deactivated: 'Deactivated',
};

export function authLabel(status: UserStatus): string {
  return AUTH_LABEL[status];
}

export function directorySummary(counts: Record<UserStatus, number>): string {
  return `${counts.active} active · ${counts.invited} invited · ${counts.deactivated} deactivated · no seat limit, self-hosted`;
}

export const STATUS_OPTIONS = [
  { value: '', label: 'Status' },
  ...USER_STATUSES.map((status) => ({
    value: status,
    label: status.charAt(0).toUpperCase() + status.slice(1),
  })),
];

type UiState = ReturnType<typeof useUiStore.getState>;

/**
 * ⌘K hands the Users page a search or an invite request through the UI store. The page takes
 * it once, on mount or while open, and clears it so it does not apply again.
 */
function useUiHandoff() {
  const [search, setSearch] = useState(() => useUiStore.getState().userSearch);
  const [inviteOpen, setInviteOpen] = useState(() => useUiStore.getState().inviteRequested);
  useEffect(() => {
    const take = (state: UiState) => {
      if (state.userSearch) {
        setSearch(state.userSearch);
        state.setUserSearch('');
      }
      if (state.inviteRequested) {
        setInviteOpen(true);
        state.requestInvite(false);
      }
    };
    const initial = useUiStore.getState();
    if (initial.userSearch) initial.setUserSearch('');
    if (initial.inviteRequested) initial.requestInvite(false);
    return useUiStore.subscribe(take);
  }, []);
  return { search, setSearch, inviteOpen, setInviteOpen };
}

/**
 * The Users page: directory counts, filters, keyset pages and the Modules column. Pending
 * invitations lead the list as INVITED rows and count as invited, since an invited person
 * has no account (and no /users row) until they accept.
 */
export function useUsers(initialTeamId = '') {
  const canManage = useCanManagePeople();
  const handoff = useUiHandoff();
  const [q, setQ] = useState(handoff.search.trim());
  const [roleId, setRoleId] = useState('');
  const [teamId, setTeamId] = useState(initialTeamId);
  const [status, setStatus] = useState<UserFilters['status']>('');

  useEffect(() => {
    const timer = setTimeout(() => setQ(handoff.search.trim()), SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [handoff.search]);

  const filter = { limit: PAGE, ...(q ? { q } : {}), ...(status ? { status } : {}) };
  const list = useInfiniteQuery({
    queryKey: queryKeys.users.list(filter),
    queryFn: ({ pageParam }) =>
      api.users.list({ ...filter, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const { directory } = useDirectory();
  const roles = useQuery(rolesQuery).data?.items ?? [];
  const teams = useQuery(teamsQuery).data?.items ?? [];
  const grants = useQuery(grantsQuery).data?.items;
  const manifests = useModules().data;
  const invitations = useQuery({ ...invitationsQuery, enabled: canManage }).data?.items;

  const invited = useMemo(
    () => invitationRows(invitations ?? [], directory.users),
    [invitations, directory.users],
  );
  const rows = useMemo(
    () =>
      [
        ...invited.filter((row) => matchesServerFilters(row, { q, status })),
        ...(list.data?.pages ?? []).flatMap((page) => page.items),
      ].filter((user) => matchesFilters(user, { roleId, teamId })),
    [invited, list.data, q, status, roleId, teamId],
  );
  const invitationIds = new Set(invited.map((row) => row.id));
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));

  return {
    canManage,
    summary: directorySummary({
      ...directory.counts,
      invited: directory.counts.invited + invited.length,
    }),
    /** True for a row that is a pending invitation rather than an account. */
    isInvitation: (user: User) => invitationIds.has(user.id),
    list,
    rows,
    roles,
    teamsOf: (user: User) =>
      user.teamIds.flatMap((id) => (teamNames.has(id) ? [teamNames.get(id) as string] : [])),
    modulesOf: (user: User) =>
      grants ? modulesForUser(user, grants).map((id) => moduleLabel(id, manifests)) : [],
    filters: { q: handoff.search, roleId, teamId, status },
    setSearch: handoff.setSearch,
    setRoleId,
    setTeamId,
    setStatus,
    roleFilterOptions: [
      { value: '', label: 'Role' },
      ...roles.map((role) => ({ value: role.id, label: role.name })),
    ],
    teamFilterOptions: [
      { value: '', label: 'Team' },
      ...teams.map((team) => ({ value: team.id, label: team.name })),
    ],
    inviteOpen: handoff.inviteOpen,
    setInviteOpen: handoff.setInviteOpen,
  };
}

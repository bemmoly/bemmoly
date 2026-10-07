import type { UserStatus } from '@bemmoly/shared';
import { Button, SearchInput, Select } from '@bemmoly/ui';
import { useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { InviteModal } from '../../components/people/invite-modal.tsx';
import { ModuleAccessDrawer } from '../../components/people/module-access-drawer.tsx';
import { UsersTable } from '../../components/people/users-table.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { NO_PEOPLE_ACCESS, roleOptions } from '../../hooks/use-people.ts';
import { useMe } from '../../hooks/use-session.ts';
import { useUserActions } from '../../hooks/use-users-actions.ts';
import { STATUS_OPTIONS, useUsers } from '../../hooks/use-users.ts';

const LATER = 'CSV import and directory sync from SSO arrive in a later release.';

/** "Manage" on a team card opens this page with ?team=<id>. */
function teamParam(search: unknown): string {
  const value = (search as Record<string, unknown> | undefined)?.['team'];
  return typeof value === 'string' ? value : '';
}

export function UsersPage() {
  const initialTeam = useRouterState({ select: (state) => teamParam(state.location.search) });
  const users = useUsers(initialTeam);
  const actions = useUserActions(users.roles);
  const me = useMe();
  const [accessOpen, setAccessOpen] = useState(false);
  const { filters } = users;

  return (
    <SettingsPage
      title="Users"
      description={users.summary}
      error={users.list.error}
      actions={
        <>
          <Button variant="secondary" onClick={() => setAccessOpen(true)}>
            Module access
          </Button>
          <Button variant="secondary" disabled title={LATER}>
            Import CSV
          </Button>
          <Button variant="secondary" disabled title={LATER}>
            Sync from SSO
          </Button>
          <Button
            variant="primary"
            disabled={!users.canManage}
            title={users.canManage ? undefined : NO_PEOPLE_ACCESS}
            onClick={() => users.setInviteOpen(true)}
          >
            Invite people
          </Button>
        </>
      }
    >
      <div className="-mt-2 flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <SearchInput
            aria-label="Search by name or email"
            placeholder="Search by name or email"
            wrapperClassName="w-65"
            value={filters.q}
            onChange={(event) => users.setSearch(event.target.value)}
          />
          <Select
            className="[field-sizing:content]"
            aria-label="Filter by role"
            options={users.roleFilterOptions}
            value={filters.roleId}
            onChange={(event) => users.setRoleId(event.target.value)}
          />
          <Select
            className="[field-sizing:content]"
            aria-label="Filter by team"
            options={users.teamFilterOptions}
            value={filters.teamId}
            onChange={(event) => users.setTeamId(event.target.value)}
          />
          <Select
            className="[field-sizing:content]"
            aria-label="Filter by status"
            options={STATUS_OPTIONS}
            value={filters.status}
            onChange={(event) => users.setStatus(event.target.value as UserStatus | '')}
          />
        </div>
        <UsersTable
          rows={users.rows}
          roleOptions={roleOptions(users.roles)}
          canManage={users.canManage}
          teamsOf={users.teamsOf}
          modulesOf={users.modulesOf}
          onRoleChange={(user, roleId) => actions.changeRole.mutate({ user, roleId })}
          actions={{
            selfId: me.user.id,
            deactivate: (user) => actions.deactivate.mutate(user),
            reactivate: (user) => actions.reactivate.mutate(user),
            resend: (user) => actions.resend.mutate(user),
            revoke: (user) => actions.revoke.mutate(user),
          }}
          footer={{
            hasMore: Boolean(users.list.hasNextPage),
            loading: users.list.isFetchingNextPage,
            onLoadMore: () => void users.list.fetchNextPage(),
          }}
          loading={users.list.isPending}
        />
      </div>
      <InviteModal open={users.inviteOpen} onClose={() => users.setInviteOpen(false)} />
      <ModuleAccessDrawer open={accessOpen} onClose={() => setAccessOpen(false)} />
    </SettingsPage>
  );
}

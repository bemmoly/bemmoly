import { Button, SearchInput, SegmentedControl, Select } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { InviteLinkModal } from '../../components/people/invite-links.tsx';
import { InviteModal } from '../../components/people/invite-modal.tsx';
import { ModuleAccessDrawer } from '../../components/people/module-access-drawer.tsx';
import { NoMatch, UsersTable } from '../../components/people/users-table.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { NO_PEOPLE_ACCESS, roleOptions } from '../../hooks/use-people.ts';
import { useMe } from '../../hooks/use-session.ts';
import { useUserActions } from '../../hooks/use-users-actions.ts';
import { useUsers } from '../../hooks/use-users.ts';

/** "Manage" from Teams opens this page with ?team=<id>. */
function teamParam(search: unknown): string {
  const value = (search as Record<string, unknown> | undefined)?.['team'];
  return typeof value === 'string' ? value : '';
}

type Segment = 'all' | 'admins' | 'invited' | 'deactivated';

export function UsersPage() {
  const initialTeam = useRouterState({ select: (state) => teamParam(state.location.search) });
  const users = useUsers(initialTeam);
  const actions = useUserActions(users.roles);
  const me = useMe();
  const [accessOpen, setAccessOpen] = useState(false);
  const { filters, counts } = users;
  const adminRole = users.roles.find((role) => role.key === 'org_admin');
  const segment: Segment = filters.status
    ? filters.status === 'active'
      ? 'all'
      : filters.status
    : adminRole && filters.roleId === adminRole.id
      ? 'admins'
      : 'all';
  const choose = (next: Segment) => {
    users.setStatus(next === 'invited' || next === 'deactivated' ? next : '');
    users.setRoleId(next === 'admins' ? (adminRole?.id ?? '') : '');
  };
  const filtered = Boolean(filters.q || filters.roleId || filters.teamId || filters.status);
  const clear = () => {
    users.setSearch('');
    users.setRoleId('');
    users.setTeamId('');
    users.setStatus('');
  };
  const total = counts.active + counts.invited + counts.deactivated;

  return (
    <SettingsPage
      title="Members"
      description="Everyone who can sign in to this workspace. Their role decides what they can change."
      error={users.list.error}
      actions={
        <>
          <Button variant="ghost" onClick={() => setAccessOpen(true)}>
            Module access
          </Button>
          <Button
            variant="primary"
            icon={<Icon name="plus" />}
            disabled={!users.canManage}
            title={users.canManage ? undefined : NO_PEOPLE_ACCESS}
            onClick={() => users.setInviteOpen(true)}
          >
            Invite people
          </Button>
        </>
      }
    >
      <div className="-mt-1 flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            aria-label="Search by name or email"
            placeholder="Search members…"
            wrapperClassName="w-full sm:w-65"
            value={filters.q}
            onChange={(event) => users.setSearch(event.target.value)}
          />
          <SegmentedControl<Segment>
            size="sm"
            aria-label="Show"
            value={segment}
            onChange={choose}
            options={[
              { value: 'all', label: <Count label="All" n={total} /> },
              { value: 'admins', label: 'Admins' },
              { value: 'invited', label: <Count label="Invited" n={counts.invited} /> },
              { value: 'deactivated', label: 'Deactivated' },
            ]}
          />
          <span className="grow" />
          <Select
            size="sm"
            className="[field-sizing:content]"
            aria-label="Filter by role"
            options={users.roleFilterOptions}
            value={filters.roleId}
            onChange={(event) => users.setRoleId(event.target.value)}
          />
          <Select
            size="sm"
            className="[field-sizing:content]"
            aria-label="Filter by team"
            searchable
            searchPlaceholder="Search teams"
            options={users.teamFilterOptions}
            value={filters.teamId}
            onChange={(event) => users.setTeamId(event.target.value)}
          />
        </div>
        <UsersTable
          rows={users.rows}
          roleOptions={roleOptions(users.roles)}
          canManage={users.canManage}
          teamsOf={users.teamsOf}
          modulesOf={users.modulesOf}
          onRoleChange={(user, roleId) =>
            users.isInvitation(user)
              ? actions.resend.mutate({ user, roleId })
              : actions.changeRole.mutate({ user, roleId })
          }
          actions={{
            selfId: me.user.id,
            deactivate: (user) => actions.deactivate.mutate(user),
            reactivate: (user) => actions.reactivate.mutate(user),
            resend: (user) => actions.resend.mutate({ user }),
            copyLink: (user) => actions.copyLink.mutate(user),
            revoke: (user) => actions.revoke.mutate(user),
          }}
          footer={{
            summary: users.summary,
            hasMore: Boolean(users.list.hasNextPage),
            loading: users.list.isFetchingNextPage,
            onLoadMore: () => void users.list.fetchNextPage(),
          }}
          loading={users.list.isPending}
          empty={filtered ? <NoMatch onClear={clear} /> : null}
        />
      </div>
      <InviteModal open={users.inviteOpen} onClose={() => users.setInviteOpen(false)} />
      <ModuleAccessDrawer open={accessOpen} onClose={() => setAccessOpen(false)} />
      <InviteLinkModal link={actions.shownLink} onClose={actions.closeLink} />
    </SettingsPage>
  );
}

function Count({ label, n }: { label: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      <span className="text-tx-3 tabular-nums">{n}</span>
    </span>
  );
}

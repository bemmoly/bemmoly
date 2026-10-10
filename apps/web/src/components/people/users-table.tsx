import type { User } from '@bemmoly/shared';
import {
  Avatar,
  avatarHue,
  EmptyState,
  RelativeTime,
  Table,
  TableSkeleton,
  type TableColumn,
  type TableFooter,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { authLabel, isLate } from '../../hooks/use-users.ts';
import { RoleMenu, type RoleChoice } from './role-menu.tsx';
import { UserMenu, type UserMenuActions } from './user-menu.tsx';

interface UsersTableProps {
  rows: readonly User[];
  roleOptions: readonly RoleChoice[];
  canManage: boolean;
  teamsOf: (user: User) => string[];
  modulesOf: (user: User) => string[];
  onRoleChange: (user: User, roleId: string) => void;
  actions: UserMenuActions;
  footer: TableFooter;
  loading: boolean;
  /** Shown when nothing matches; the page decides between "no one" and "no match". */
  empty: ReactNode;
}

/** A short sentence-case chip: "You", "Invited", "Deactivated". */
function Chip({ children, tone }: { children: ReactNode; tone: 'neutral' | 'amber' }) {
  return (
    <span
      className={
        tone === 'amber'
          ? 'inline-flex h-5 shrink-0 items-center rounded-chip bg-amber-50 px-1.75 text-12 font-medium text-amber-tx'
          : 'inline-flex h-5 shrink-0 items-center rounded-chip bg-sunken px-1.75 text-12 font-medium text-tx-2 shadow-[inset_0_0_0_1px_var(--line)]'
      }
    >
      {children}
    </span>
  );
}

/** A list of names as calm text, with the full list on hover when it is cut short. */
function Names({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-tx-3">None</span>;
  const text = items.join(', ');
  return (
    <span className="block truncate text-tx-2" title={text}>
      {text}
    </span>
  );
}

const WIDTHS = {
  person: 'minmax(0,1.6fr)',
  role: '150px',
  teams: 'minmax(0,1fr)',
  modules: 'minmax(0,0.8fr)',
  auth: '100px',
  last: '110px',
  menu: '28px',
};

/** The review's members table: person, a quiet role menu, teams, modules, sign-in, last seen. */
export function UsersTable({
  rows,
  roleOptions,
  canManage,
  teamsOf,
  modulesOf,
  onRoleChange,
  actions,
  footer,
  loading,
  empty,
}: UsersTableProps) {
  const columns: TableColumn<User>[] = [
    {
      key: 'person',
      header: 'Person',
      width: WIDTHS.person,
      render: (user) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={user.name} hue={avatarHue(user.id)} size={28} />
          <div className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 truncate font-medium text-tx">
                {user.status === 'invited' ? user.email : user.name}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {user.id === actions.selfId && <Chip tone="neutral">You</Chip>}
                {user.status === 'invited' && <Chip tone="amber">Invited</Chip>}
                {user.status === 'deactivated' && <Chip tone="neutral">Deactivated</Chip>}
              </span>
            </span>
            {user.status !== 'invited' && (
              <span className="truncate text-12 text-tx-3">{user.email}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      width: WIDTHS.role,
      render: (user) => (
        <RoleMenu
          person={user.name}
          value={user.roleId}
          options={roleOptions}
          disabled={!canManage || user.status === 'deactivated'}
          reason={canManage ? 'Reactivate this person to change their role.' : undefined}
          onChange={(roleId) => onRoleChange(user, roleId)}
        />
      ),
    },
    {
      key: 'teams',
      header: 'Teams',
      width: WIDTHS.teams,
      hideOnPhone: true,
      render: (user) => <Names items={teamsOf(user)} />,
    },
    {
      key: 'modules',
      header: 'Modules',
      width: WIDTHS.modules,
      hideOnPhone: true,
      render: (user) => <Names items={modulesOf(user)} />,
    },
    {
      key: 'auth',
      header: 'Sign-in',
      width: WIDTHS.auth,
      hideOnPhone: true,
      render: (user) => <span className="text-tx-2">{authLabel(user.status)}</span>,
    },
    {
      key: 'last',
      header: 'Last active',
      width: WIDTHS.last,
      hideOnPhone: true,
      render: (user) =>
        user.status === 'invited' ? (
          <span className="text-tx-3">
            Invited <RelativeTime iso={user.createdAt} />
          </span>
        ) : user.lastSeenAt ? (
          <RelativeTime
            iso={user.lastSeenAt}
            className={isLate(user.lastSeenAt) ? 'text-amber-tx' : 'text-tx-3'}
          />
        ) : (
          <span className="text-amber-tx">Never</span>
        ),
    },
    {
      key: 'menu',
      header: <span className="sr-only">Actions</span>,
      width: WIDTHS.menu,
      align: 'center',
      reveal: true,
      render: (user) => (canManage ? <UserMenu user={user} actions={actions} /> : null),
    },
  ];
  if (loading && rows.length === 0) {
    return (
      <TableSkeleton
        label="Loading people"
        rows={6}
        columns={Object.values(WIDTHS).map((width, index, all) => ({
          width,
          ...(index === all.length - 1 ? { cell: <span /> } : {}),
        }))}
      />
    );
  }
  return (
    <Table
      label="Users"
      columns={columns}
      rows={rows}
      rowKey={(user) => user.id}
      footer={footer}
      empty={empty}
    />
  );
}

/** Nothing matched the search or a filter: say so and offer the way back. */
export function NoMatch({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      icon={<Icon name="search" />}
      title="No one matches"
      description="Nobody here fits the search and filters."
      action={
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 font-sans font-medium text-acc hover:underline"
          onClick={onClear}
        >
          Clear search and filters
        </button>
      }
    />
  );
}

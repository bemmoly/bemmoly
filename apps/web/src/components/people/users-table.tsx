import { formatRelative } from '@bemmoly/core-web';
import type { User } from '@bemmoly/shared';
import {
  Avatar,
  avatarHue,
  EmptyState,
  Select,
  Table,
  Tag,
  type SelectOption,
  type TableColumn,
  type TableFooter,
} from '@bemmoly/ui';
import { authLabel, isLate } from '../../hooks/use-users.ts';
import { Loading } from '../form.tsx';
import { UserMenu, type UserMenuActions } from './user-menu.tsx';

interface UsersTableProps {
  rows: readonly User[];
  roleOptions: readonly SelectOption[];
  canManage: boolean;
  teamsOf: (user: User) => string[];
  modulesOf: (user: User) => string[];
  onRoleChange: (user: User, roleId: string) => void;
  actions: UserMenuActions;
  footer: TableFooter;
  loading: boolean;
}

function Chips({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-12 text-tx5">None</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Tag key={item} size="md">
          {item}
        </Tag>
      ))}
    </div>
  );
}

/** The People mock's user grid, with the Modules column after Teams. */
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
}: UsersTableProps) {
  const columns: TableColumn<User>[] = [
    {
      key: 'person',
      header: 'Person',
      width: 'minmax(0,1.4fr)',
      render: (user) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={user.name} hue={avatarHue(user.id)} size={30} />
          <div className="flex min-w-0 flex-col gap-px">
            <span className="font-medium">{user.name}</span>
            <span className="truncate text-12 text-tx5">{user.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Org role',
      width: '150px',
      render: (user) => (
        <Select
          size="sm"
          aria-label={`Org role for ${user.name}`}
          options={roleOptions}
          value={user.roleId}
          disabled={!canManage}
          onChange={(event) => onRoleChange(user, event.target.value)}
        />
      ),
    },
    {
      key: 'teams',
      header: 'Teams',
      width: 'minmax(0,1fr)',
      render: (user) => <Chips items={teamsOf(user)} />,
    },
    {
      key: 'modules',
      header: 'Modules',
      width: 'minmax(0,0.8fr)',
      render: (user) => <Chips items={modulesOf(user)} />,
    },
    {
      key: 'auth',
      header: 'Auth',
      width: '110px',
      render: (user) => <span className="text-12 text-tx3">{authLabel(user.status)}</span>,
    },
    {
      key: 'last',
      header: 'Last active',
      width: '110px',
      render: (user) => (
        <span className={`text-12 ${isLate(user.lastSeenAt) ? 'text-warn-fg' : 'text-tx4'}`}>
          {formatRelative(user.lastSeenAt)}
        </span>
      ),
    },
    {
      key: 'menu',
      header: <span className="sr-only">Actions</span>,
      width: '28px',
      align: 'center',
      render: (user) => (canManage ? <UserMenu user={user} actions={actions} /> : null),
    },
  ];
  return (
    <Table
      label="Users"
      columns={columns}
      rows={rows}
      rowKey={(user) => user.id}
      footer={footer}
      empty={
        loading ? (
          <Loading label="Loading people" lines={4} />
        ) : (
          <EmptyState
            title="No one matches"
            description="Clear the search or a filter to see more people."
          />
        )
      }
    />
  );
}

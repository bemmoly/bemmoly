import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { Avatar, type AvatarHue } from '../avatar/avatar.tsx';
import { EmptyState } from '../empty-state/empty-state.tsx';
import { Select } from '../select/select.tsx';
import { Tag } from '../tag/tag.tsx';
import { Table, type TableColumn } from './table.tsx';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  teams: string[];
  auth: string;
  last: string;
  hue: AvatarHue;
  stale?: boolean;
}

const USERS: User[] = [
  {
    id: 'RS',
    name: 'Rohan S.',
    email: 'rohan@acmelabs.dev',
    role: 'Org admin',
    teams: ['Platform', 'Growth'],
    auth: 'Google SSO',
    last: 'now',
    hue: 'accent',
  },
  {
    id: 'PN',
    name: 'Priya N.',
    email: 'priya@acmelabs.dev',
    role: 'Project admin',
    teams: ['Platform'],
    auth: 'Google SSO',
    last: '2h ago',
    hue: 'green',
  },
  {
    id: 'AK',
    name: 'Aisha K.',
    email: 'aisha@acmelabs.dev',
    role: 'Member',
    teams: ['Platform'],
    auth: 'Google SSO',
    last: '3h ago',
    hue: 'orange',
  },
  {
    id: 'JM',
    name: 'Jonas M.',
    email: 'jonas@acmelabs.dev',
    role: 'Member',
    teams: ['Platform', 'Mobile'],
    auth: 'Okta',
    last: 'yesterday',
    hue: 'violet',
  },
  {
    id: 'DV',
    name: 'Dev P.',
    email: 'dev@contractor.io',
    role: 'Contractor',
    teams: ['Mobile'],
    auth: 'Password',
    last: '12 days ago',
    hue: 'sky',
    stale: true,
  },
];

const ROLES = ['Org admin', 'Project admin', 'Member', 'Contractor', 'Viewer'].map((r) => ({
  value: r,
  label: r,
}));

const COLUMNS: TableColumn<User>[] = [
  {
    key: 'person',
    header: 'Person',
    width: 'minmax(0,1.4fr)',
    render: (u) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={u.name} initials={u.id} hue={u.hue} size={30} />
        <div className="flex min-w-0 flex-col gap-px">
          <span className="font-medium">{u.name}</span>
          <span className="truncate text-12 text-tx5">{u.email}</span>
        </div>
      </div>
    ),
  },
  {
    key: 'role',
    header: 'Org role',
    width: '150px',
    render: (u) => (
      <Select aria-label={`Role of ${u.name}`} size="sm" options={ROLES} defaultValue={u.role} />
    ),
  },
  {
    key: 'teams',
    header: 'Teams',
    width: 'minmax(0,1fr)',
    render: (u) => (
      <div className="flex flex-wrap gap-1">
        {u.teams.map((t) => (
          <Tag key={t} size="md">
            {t}
          </Tag>
        ))}
      </div>
    ),
  },
  {
    key: 'auth',
    header: 'Auth',
    width: '110px',
    render: (u) => <span className="text-12 text-tx3">{u.auth}</span>,
  },
  {
    key: 'last',
    header: 'Last active',
    width: '110px',
    render: (u) => (
      <span className={u.stale ? 'text-12 text-warn-fg' : 'text-12 text-tx4'}>{u.last}</span>
    ),
  },
  {
    key: 'more',
    header: '',
    width: '28px',
    align: 'center',
    render: () => <Icon name="more" className="text-tx6" label="More" />,
  },
];

const meta = { title: 'Components/Table', component: Table<User> } satisfies Meta<
  typeof Table<User>
>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Users: Story = {
  args: { label: 'Users', columns: COLUMNS, rows: USERS, rowKey: (u: User) => u.id },
  parameters: {
    mock: [
      { file: 'Bemmoly People.dc.html', x: 276, y: 194, w: 1050, h: 360, note: 'Users table' },
    ],
  },
  render: function Render(args) {
    const [rows, setRows] = useState(USERS.slice(0, 4));
    const [loading, setLoading] = useState(false);
    return (
      <div className="w-260">
        <Table
          {...args}
          rows={rows}
          footer={{
            summary: `Showing ${rows.length} of 42`,
            hasMore: rows.length < USERS.length,
            loading,
            onLoadMore: () => {
              setLoading(true);
              setTimeout(() => {
                setRows(USERS);
                setLoading(false);
              }, 600);
            },
          }}
        />
      </div>
    );
  },
};

export const Empty: Story = {
  args: { label: 'Users', columns: COLUMNS, rows: [], rowKey: (u: User) => u.id },
  render: (args) => (
    <div className="w-260">
      <Table
        {...args}
        empty={
          <EmptyState
            icon={<Icon name="circle" />}
            title="No one matches those filters"
            description="Clear the role or team filter to see everyone in Acme Labs."
          />
        }
      />
    </div>
  ),
};

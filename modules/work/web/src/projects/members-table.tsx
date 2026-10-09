import type { ProjectMember } from '@bemmoly/module-work/shared';
import { formatRelative } from '@bemmoly/core-web';
import {
  Avatar,
  avatarHue,
  Badge,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
  Select,
  Table,
  TableSkeleton,
  type SelectOption,
  type TableColumn,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { BoxCell, MenuCell, TwoLineCell } from '../skeletons/table-cells.tsx';

const LAST_ADMIN = 'A project keeps at least one project admin.';

export interface MembersTableProps {
  rows: readonly ProjectMember[];
  roleOptions: readonly SelectOption[];
  canManage: boolean;
  loading: boolean;
  filtered: boolean;
  /** The signed-in person, marked "You". */
  viewerId: string | null;
  isLastAdmin: (member: ProjectMember) => boolean;
  onRoleChange: (member: ProjectMember, roleId: string) => void;
  onRemove: (member: ProjectMember) => void;
}

function MemberMenu({
  member,
  locked,
  onRemove,
}: {
  member: ProjectMember;
  locked: boolean;
  onRemove: (member: ProjectMember) => void;
}) {
  return (
    <Menu
      align="end"
      widthClassName="w-56"
      trigger={(props) => (
        <IconButton
          {...props}
          label={`Actions for ${member.name}`}
          icon="more"
          size="xs"
          className="font-normal text-tx6"
        />
      )}
    >
      <MenuItem
        tone="danger"
        disabled={locked}
        hint={locked ? 'Last admin' : undefined}
        onSelect={() => onRemove(member)}
      >
        Remove from project
      </MenuItem>
    </Menu>
  );
}

/** The People mock's user grid, narrowed to a project: person, project role, when added. */
export function MembersTable({
  rows,
  roleOptions,
  canManage,
  loading,
  filtered,
  viewerId,
  isLastAdmin,
  onRoleChange,
  onRemove,
}: MembersTableProps) {
  const columns: TableColumn<ProjectMember>[] = [
    {
      key: 'person',
      header: 'Person',
      width: 'minmax(0,1.6fr)',
      render: (member) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={member.name} hue={avatarHue(member.userId)} size={30} />
          <div className="flex min-w-0 flex-col gap-px">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium" title={member.name}>
                {member.name}
              </span>
              {member.userId === viewerId && <Badge tone="neutral">YOU</Badge>}
              {member.status === 'invited' && <Badge tone="amber">INVITED</Badge>}
              {member.status === 'deactivated' && <Badge tone="neutral">DEACTIVATED</Badge>}
            </span>
            <span className="truncate text-12 text-tx5" title={member.email}>
              {member.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Project role',
      width: '170px',
      render: (member) => {
        const locked = isLastAdmin(member);
        return (
          <Select
            size="sm"
            aria-label={`Project role for ${member.name}`}
            options={roleOptions}
            value={member.roleId}
            disabled={!canManage || locked}
            title={locked ? LAST_ADMIN : undefined}
            onChange={(event) => onRoleChange(member, event.value)}
          />
        );
      },
    },
    {
      key: 'added',
      header: 'Added',
      width: '120px',
      render: (member) => (
        <span className="text-12 text-tx4">{formatRelative(member.addedAt)}</span>
      ),
    },
    {
      key: 'menu',
      header: <span className="sr-only">Actions</span>,
      width: '28px',
      align: 'center',
      render: (member) =>
        canManage ? (
          <MemberMenu member={member} locked={isLastAdmin(member)} onRemove={onRemove} />
        ) : null,
    },
  ];
  if (loading)
    return (
      <TableSkeleton
        label="Loading members"
        rows={4}
        columns={[
          { width: 'minmax(0,1.6fr)', cell: <TwoLineCell width="22%" second="34%" avatar={30} /> },
          { width: '170px', cell: <BoxCell width={86} height={26} /> },
          { width: '120px' },
          { width: '28px', align: 'center', cell: <MenuCell /> },
        ]}
      />
    );
  return (
    <Table
      label="Project members"
      columns={columns}
      rows={rows}
      rowKey={(member) => member.userId}
      empty={
        <EmptyState
          icon={<Icon name={filtered ? 'search' : 'people'} />}
          title={filtered ? 'No one matches' : 'No members yet'}
          description={
            filtered
              ? 'Clear the search to see everyone on the project.'
              : 'Add people or a whole team so they can see and work on its issues.'
          }
        />
      }
    />
  );
}

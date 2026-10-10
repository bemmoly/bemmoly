import {
  Avatar,
  AvatarStack,
  EntityTile,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  Table,
  TableSkeleton,
  TableSkeletonLine,
  type TableColumn,
} from '@bemmoly/ui';
import type { ReactNode } from 'react';
import type { TeamCardView } from '../../hooks/use-teams.ts';

export interface TeamRowActions {
  canManage: boolean;
  open: (team: TeamCardView) => void;
  remove: (team: TeamCardView) => void;
}

/** Keeps keys and clicks inside the row menu from also opening the row. */
const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-tx-3">{children}</span>;
}

/** The ··· at the end of a team row, also reachable from the keyboard. */
function TeamMenu({ team, actions }: { team: TeamCardView; actions: TeamRowActions }) {
  return (
    <Menu
      align="end"
      widthClassName="w-52"
      trigger={(props) => (
        <IconButton {...props} label={`Actions for ${team.name}`} icon="more" size="xs" />
      )}
    >
      <MenuItem onSelect={() => actions.open(team)}>View members</MenuItem>
      {actions.canManage && (
        <>
          <MenuSeparator />
          <MenuItem tone="danger" onSelect={() => actions.remove(team)}>
            Delete team…
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

const WIDTHS = {
  team: 'minmax(0,1.3fr)',
  lead: 'minmax(0,1fr)',
  members: '150px',
  modules: 'minmax(0,1fr)',
  role: '110px',
  menu: '28px',
};

function columns(actions: TeamRowActions): TableColumn<TeamCardView>[] {
  return [
    {
      key: 'team',
      header: 'Team',
      width: WIDTHS.team,
      render: (team) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <EntityTile name={team.name} color={team.color} size={26} />
          <span className="truncate font-medium text-tx" title={team.name}>
            {team.name}
          </span>
        </span>
      ),
    },
    {
      key: 'lead',
      header: 'Lead',
      width: WIDTHS.lead,
      hideOnPhone: true,
      render: (team) =>
        team.leadPerson ? (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={team.leadPerson.name} hue={team.leadPerson.hue} size={22} />
            <span className="truncate">{team.leadPerson.name}</span>
          </span>
        ) : (
          <Muted>No lead</Muted>
        ),
    },
    {
      key: 'members',
      header: 'Members',
      width: WIDTHS.members,
      render: (team) => (
        <span className="flex items-center gap-2">
          {team.people.length > 0 && (
            <AvatarStack people={team.people} size={20} max={4} label={`Members of ${team.name}`} />
          )}
          <span className="text-tx-3 tabular-nums">{team.memberCount}</span>
        </span>
      ),
    },
    {
      key: 'modules',
      header: 'Module access',
      width: WIDTHS.modules,
      hideOnPhone: true,
      render: (team) =>
        team.modules.length ? (
          <span className="truncate" title={team.modules.join(', ')}>
            {team.modules.join(', ')}
          </span>
        ) : (
          <Muted>None</Muted>
        ),
    },
    {
      key: 'role',
      header: 'Default role',
      width: WIDTHS.role,
      hideOnPhone: true,
      render: (team) => <span className="truncate">{team.defaultRole}</span>,
    },
    {
      key: 'menu',
      header: <span className="sr-only">Actions</span>,
      width: WIDTHS.menu,
      align: 'center',
      reveal: true,
      render: (team) => (
        <span onClick={(event) => event.stopPropagation()} onKeyDown={stop}>
          <TeamMenu team={team} actions={actions} />
        </span>
      ),
    },
  ];
}

/** Teams as the review's table: tile, lead, a members facepile with the count, modules, role. */
export function TeamsTable({
  teams,
  actions,
  empty,
}: {
  teams: readonly TeamCardView[];
  actions: TeamRowActions;
  empty: ReactNode;
}) {
  return (
    <Table
      label="Teams"
      columns={columns(actions)}
      rows={teams}
      rowKey={(team) => team.id}
      onRowClick={actions.open}
      empty={empty}
    />
  );
}

/** The table while teams load, with the same tracks so nothing shifts. */
export function TeamsSkeleton() {
  return (
    <TableSkeleton
      label="Loading teams"
      rows={5}
      columns={[
        {
          width: WIDTHS.team,
          cell: (
            <span className="flex w-full items-center gap-2.5">
              <span className="size-6.5 shrink-0 rounded-control bg-sunken" />
              <TableSkeletonLine width="50%" />
            </span>
          ),
        },
        { width: WIDTHS.lead },
        { width: WIDTHS.members },
        { width: WIDTHS.modules },
        { width: WIDTHS.role },
        { width: WIDTHS.menu, cell: <span /> },
      ]}
    />
  );
}

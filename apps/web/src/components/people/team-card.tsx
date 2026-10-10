import { AvatarStack, Card, EntityTile } from '@bemmoly/ui';
import { Link } from '@tanstack/react-router';
import type { TeamCardView } from '../../hooks/use-teams.ts';
import { LINK_ACTION } from '../actions.ts';

/** A team in the 2-column grid: colour tile, lead and size, default role, members, Manage. */
export function TeamCard({ team }: { team: TeamCardView }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2.5">
        <EntityTile name={team.name} letter={team.initials} color={team.color} size={34} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-14 font-semibold">{team.name}</span>
          <span className="text-12 text-tx5">
            Lead: {team.lead} · {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
          </span>
        </div>
      </div>
      <div className="flex gap-2 text-12h">
        <span className="w-17.5 shrink-0 text-tx5">Default role</span>
        <span className="font-medium">{team.defaultRole}</span>
      </div>
      <div className="mt-auto flex items-center">
        <AvatarStack people={team.people} label={`Members of ${team.name}`} />
        <Link
          to="/settings/users"
          search={{ team: team.id }}
          className={`ml-2 text-12h ${LINK_ACTION}`}
        >
          Manage
        </Link>
      </div>
    </Card>
  );
}

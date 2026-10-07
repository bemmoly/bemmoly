import { Button, Card, EmptyState } from '@bemmoly/ui';
import { useState } from 'react';
import { CreateTeamModal } from '../../components/people/create-team-modal.tsx';
import { TeamCard } from '../../components/people/team-card.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { NO_PEOPLE_ACCESS } from '../../hooks/use-people.ts';
import { useTeams } from '../../hooks/use-teams.ts';

export function TeamsPage() {
  const { canManage, query, cards } = useTeams();
  const [creating, setCreating] = useState(false);
  return (
    <SettingsPage
      title="Teams"
      description="Teams own projects and doc spaces. A person can be in several."
      loading={query.isPending}
      error={query.error}
      actions={
        <Button
          variant="primary"
          disabled={!canManage}
          title={canManage ? undefined : NO_PEOPLE_ACCESS}
          onClick={() => setCreating(true)}
        >
          Create team
        </Button>
      }
    >
      {cards.length ? (
        <div className="-mt-2 grid grid-cols-2 gap-3">
          {cards.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="No teams yet"
            description="Create a team to grant module access to a group of people at once."
          />
        </Card>
      )}
      <CreateTeamModal open={creating} onClose={() => setCreating(false)} />
    </SettingsPage>
  );
}

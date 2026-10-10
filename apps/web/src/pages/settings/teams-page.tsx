import { Button, ConfirmChange, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { FormError } from '../../components/form.tsx';
import { CreateTeamModal } from '../../components/people/create-team-modal.tsx';
import { TeamsSkeleton, TeamsTable } from '../../components/people/teams-table.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { NO_PEOPLE_ACCESS } from '../../hooks/use-people.ts';
import { useDeleteTeam, useTeams, type TeamCardView } from '../../hooks/use-teams.ts';

export function TeamsPage() {
  const { canManage, query, cards } = useTeams();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TeamCardView | null>(null);
  const remove = useDeleteTeam(() => setDeleting(null));
  const create = (
    <Button
      variant="primary"
      icon={<Icon name="plus" />}
      disabled={!canManage}
      title={canManage ? undefined : NO_PEOPLE_ACCESS}
      onClick={() => setCreating(true)}
    >
      New team
    </Button>
  );
  return (
    <SettingsPage
      title="Teams"
      description="Teams own projects and doc spaces. A person can be in several."
      loading={query.isPending}
      skeleton={<TeamsSkeleton />}
      error={query.error}
      actions={create}
    >
      <TeamsTable
        teams={cards}
        actions={{
          canManage,
          open: (team) => void navigate({ to: '/settings/users', search: { team: team.id } }),
          remove: (team) => {
            remove.reset();
            setDeleting(team);
          },
        }}
        empty={
          <EmptyState
            icon={<Icon name="people" />}
            title="No teams yet"
            description="Create a team to grant module access to a group of people at once."
            action={canManage ? create : undefined}
          />
        }
      />
      <CreateTeamModal open={creating} onClose={() => setCreating(false)} />
      <ConfirmChange
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'team'}?`}
        consequences={[
          'Its members stay in the workspace but leave the team.',
          'Module access granted to the team stops for people who had it only through the team.',
          'This cannot be undone.',
        ]}
        confirmWord={deleting?.name ?? ''}
        confirmLabel="Delete team"
        busy={remove.isPending}
        error={remove.error ? <FormError error={remove.error} /> : null}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </SettingsPage>
  );
}

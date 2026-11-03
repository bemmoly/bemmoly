import { useT } from '@bemmoly/core-web';
import type { ApprovalGroup } from '@bemmoly/module-pipelines/shared';
import { Button, Card, CardHeader } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { useEnvironments } from '../../../hooks/use-environments.ts';
import { useApprovalGroups, usePeople, usePipelinesMe } from '../../../hooks/use-roles.ts';
import { rolesText } from '../../../i18n/catalog.ts';
import { LoadFailed } from '../../../parts/load-failed.tsx';
import { RowsSkeleton } from '../../../parts/rows-skeleton.tsx';
import { ScreenFrame } from '../../screen-frame.tsx';
import { AddMembersDialog } from './add-members-dialog.tsx';
import { GroupDialog } from './group-dialog.tsx';
import { GroupsCard } from './groups-card.tsx';
import { InviteDialog } from './invite-dialog.tsx';
import { PeopleTable } from './people-table.tsx';
import { RoleCards } from './role-cards.tsx';
import { usePeopleActions } from './use-people-actions.ts';

/**
 * Platform › People and roles: the four roles, everyone's role (changed in place), and the
 * approval groups environments' approval rules ask. Invite gives new people a role.
 */
export default function PeopleScreen() {
  const t = useT(rolesText);
  const me = usePipelinesMe().data;
  const people = usePeople();
  const groups = useApprovalGroups();
  const environments = useEnvironments();
  const actions = usePeopleActions();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<{ group: ApprovalGroup | null } | null>(null);
  const [adding, setAdding] = useState<ApprovalGroup | null>(null);
  const names = new Map(environments.data?.items.map((env) => [env.key, env.name]));
  const withRole = (people.data?.items ?? [])
    .filter((person) => !person.pending)
    .map((person) => ({
      value: person.user.id,
      label: person.user.name,
      description: person.email,
    }));
  const groupOptions = (groups.data?.items ?? []).map((group) => ({
    value: group.id,
    label: group.name,
  }));
  return (
    <ScreenFrame title={t('pipelinesRoles.people.title')}>
      <RoleCards />
      <Card>
        <CardHeader
          title={t('pipelinesRoles.people.heading')}
          actions={
            <Button
              size="sm"
              variant="primary"
              icon={<Icon name="mail" />}
              onClick={() => setInviting(true)}
            >
              {t('pipelinesRoles.people.invite')}
            </Button>
          }
        />
        {people.error ? (
          <LoadFailed bare error={people.error} onRetry={() => void people.refetch()} />
        ) : people.data ? (
          <PeopleTable
            people={people.data.items}
            me={me?.user.id ?? ''}
            environmentName={(key) => names.get(key) ?? key}
            onRole={actions.setRole}
            onRemove={actions.remove}
          />
        ) : (
          <RowsSkeleton columns={4} rows={3} />
        )}
      </Card>
      {groups.error ? (
        <LoadFailed error={groups.error} onRetry={() => void groups.refetch()} />
      ) : (
        <GroupsCard
          groups={groups.data?.items ?? []}
          onNew={() => setEditing({ group: null })}
          onAdd={setAdding}
          onRename={(group) => setEditing({ group })}
          onDelete={actions.deleteGroup}
          onRemoveMember={actions.removeMember}
        />
      )}
      <InviteDialog open={inviting} onClose={() => setInviting(false)} groups={groupOptions} />
      <GroupDialog
        key={editing?.group?.id ?? 'new'}
        open={editing !== null}
        group={editing?.group ?? null}
        people={withRole}
        onClose={() => setEditing(null)}
      />
      <AddMembersDialog group={adding} people={withRole} onClose={() => setAdding(null)} />
    </ScreenFrame>
  );
}

import { Avatar, Button, Field, IconButton, Modal, Select, Spinner, Tag } from '@bemmoly/ui';
import { useTeamMembers } from '../../hooks/use-team-members.ts';
import type { TeamCardView } from '../../hooks/use-teams.ts';
import { FormError } from '../form.tsx';

/** "Manage members": add people by search, remove them one by one. The lead stays on the team. */
export function TeamMembersModal({
  team,
  canManage,
  onClose,
}: {
  team: TeamCardView;
  canManage: boolean;
  onClose: () => void;
}) {
  const members = useTeamMembers(team);
  const error = members.add.error ?? members.remove.error ?? members.query.error;
  return (
    <Modal
      open
      onClose={onClose}
      title={`${team.name} members`}
      description={`${members.rows.length} ${members.rows.length === 1 ? 'person' : 'people'}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-3.5">
        {canManage && (
          <Field label="Add people">
            <Select
              size="md"
              searchable
              searchPlaceholder="Search people"
              placeholder="Find someone to add"
              loadOptions={members.searchPeople}
              options={[]}
              value=""
              disabled={members.add.isPending}
              onChange={(event) => event.target.value && members.add.mutate(event.target.value)}
            />
          </Field>
        )}
        {members.query.isPending ? (
          <Spinner />
        ) : members.rows.length === 0 ? (
          <p className="text-tx-3">No one is on this team yet.</p>
        ) : (
          <ul aria-label={`Members of ${team.name}`} className="flex flex-col">
            {members.rows.map((row) => (
              <li key={row.userId} className="flex items-center gap-2.5 py-1.5">
                <Avatar name={row.name} hue={row.hue} size={24} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-tx">{row.name}</span>
                  <span className="truncate text-tx-3">{row.email}</span>
                </span>
                {row.isLead && <Tag size="sm">Lead</Tag>}
                {canManage && (
                  <IconButton
                    icon="close"
                    size="xs"
                    label={row.isLead ? 'Change the lead to remove them' : `Remove ${row.name}`}
                    disabled={row.isLead || members.remove.isPending}
                    onClick={() => members.remove.mutate(row)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        <FormError error={error} />
      </div>
    </Modal>
  );
}

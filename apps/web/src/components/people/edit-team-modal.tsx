import { Button, Field, Input, Modal, Select } from '@bemmoly/ui';
import { useEditTeam, type TeamCardView } from '../../hooks/use-teams.ts';
import { FormError } from '../form.tsx';

/** "Edit team": rename it or hand it to a new lead, who joins the team if not already on it. */
export function EditTeamModal({ team, onClose }: { team: TeamCardView; onClose: () => void }) {
  const edit = useEditTeam(team, onClose);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${team.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="edit-team-form"
            disabled={!edit.dirty}
            loading={edit.mutation.isPending}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-team-form" onSubmit={edit.submit} noValidate className="flex flex-col gap-3.5">
        <Field label="Name" error={edit.errors['name']}>
          <Input
            size="lg"
            autoFocus
            value={edit.form.name}
            onChange={(event) => edit.update({ name: event.target.value })}
          />
        </Field>
        <Field label="Lead" error={edit.errors['leadUserId']}>
          <Select
            size="md"
            searchable
            searchPlaceholder="Search people"
            loadOptions={edit.searchLeads}
            options={edit.leadOptions}
            value={edit.form.leadUserId}
            onChange={(event) => edit.update({ leadUserId: event.target.value })}
          />
        </Field>
        <FormError error={edit.formError} />
      </form>
    </Modal>
  );
}

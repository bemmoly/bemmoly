import { Button, Field, Input, Modal, Select } from '@bemmoly/ui';
import { useCreateTeam } from '../../hooks/use-teams.ts';
import { FormError } from '../form.tsx';

/** "Create team": a name and an optional lead, who becomes its first member. */
export function CreateTeamModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateTeam(onClose);
  const close = () => {
    create.reset();
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Create team"
      description="Teams group people for module access, projects and doc spaces."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="create-team-form"
            loading={create.mutation.isPending}
          >
            Create team
          </Button>
        </>
      }
    >
      <form
        id="create-team-form"
        onSubmit={create.submit}
        noValidate
        className="flex flex-col gap-3.5"
      >
        <Field label="Name" error={create.errors['name']}>
          <Input
            size="lg"
            autoFocus
            placeholder="Platform"
            value={create.form.name}
            onChange={(event) => create.update({ name: event.target.value })}
          />
        </Field>
        <Field label="Lead" error={create.errors['leadUserId']}>
          <Select
            size="md"
            searchable
            searchPlaceholder="Search people"
            loadOptions={create.searchLeads}
            options={create.leadOptions}
            value={create.form.leadUserId}
            onChange={(event) => create.update({ leadUserId: event.target.value })}
          />
        </Field>
        <FormError error={create.formError} />
      </form>
    </Modal>
  );
}

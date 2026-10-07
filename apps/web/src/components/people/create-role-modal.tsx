import type { Role } from '@bemmoly/shared';
import { Button, Field, Input, Modal, Select } from '@bemmoly/ui';
import { useCreateRole } from '../../hooks/use-roles.ts';

/** "Create custom role": a name, and optionally the role whose column it starts from. */
export function CreateRoleModal({
  open,
  onClose,
  roles,
}: {
  open: boolean;
  onClose: () => void;
  roles: readonly Role[];
}) {
  const create = useCreateRole(onClose);
  const close = () => {
    create.reset();
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Create custom role"
      description="A new column in the matrix. Tick what it may do, then save."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="create-role-form"
            loading={create.mutation.isPending}
          >
            Create role
          </Button>
        </>
      }
    >
      <form
        id="create-role-form"
        onSubmit={create.submit}
        noValidate
        className="flex flex-col gap-3.5"
      >
        <Field label="Name" error={create.errors['name']}>
          <Input
            size="lg"
            autoFocus
            placeholder="Auditor"
            value={create.form.name}
            onChange={(event) => create.update({ name: event.target.value })}
          />
        </Field>
        <Field
          label="Start from"
          hint="Copies that role's ticks and locks."
          error={create.errors['copyFromRoleId']}
        >
          <Select
            size="md"
            options={[
              { value: '', label: 'Nothing ticked' },
              ...roles.map((role) => ({ value: role.id, label: role.name })),
            ]}
            value={create.form.copyFromRoleId}
            onChange={(event) => create.update({ copyFromRoleId: event.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
}

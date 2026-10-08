import { Button, Field, Modal, Select, Textarea } from '@bemmoly/ui';
import { useInviteForm } from '../../hooks/use-users-invite.ts';

/** Invite people: addresses, a role and an optional team, sent as one request. */
export function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invite = useInviteForm(onClose);
  const close = () => {
    invite.reset();
    onClose();
  };
  const sending = invite.mutation.isPending;
  return (
    <Modal
      open={open}
      onClose={close}
      title="Invite people"
      description="Each address gets an email with a link to set a password."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="invite-form" loading={sending}>
            {invite.count > 1 ? `Send ${invite.count} invitations` : 'Send invitation'}
          </Button>
        </>
      }
    >
      <form id="invite-form" onSubmit={invite.submit} noValidate className="flex flex-col gap-3.5">
        <Field label="Email addresses" error={invite.errors['emails']}>
          <Textarea
            autoFocus
            rows={4}
            placeholder="Paste addresses, comma or newline separated…"
            value={invite.form.text}
            onChange={(event) => invite.update({ text: event.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role" error={invite.errors['roleId']}>
            <Select
              size="md"
              searchable
              searchPlaceholder="Search roles"
              options={invite.roleOptions}
              value={invite.form.roleId}
              onChange={(event) => invite.update({ roleId: event.target.value })}
            />
          </Field>
          <Field label="Team" hint="Optional" error={invite.errors['teamId']}>
            <Select
              size="md"
              searchable
              searchPlaceholder="Search teams"
              options={invite.teamOptions}
              value={invite.form.teamId}
              onChange={(event) => invite.update({ teamId: event.target.value })}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

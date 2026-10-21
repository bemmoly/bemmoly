import { Button, Field, Input, Modal } from '@bemmoly/ui';
import { useState } from 'react';

/** Names a new dashboard, or renames the open one. */
export function DashboardNameDialog({
  open,
  title,
  action,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  title: string;
  action: string;
  initial: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const ready = name.trim() !== '';
  const save = () => {
    if (!ready) return;
    onSave(name.trim());
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description="Dashboards are yours: only you see them and change them."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!ready} onClick={save}>
            {action}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Field label="Name">
          <Input
            autoFocus
            value={name}
            maxLength={120}
            placeholder="Sprint health"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}

export function DeleteDashboardDialog({
  open,
  name,
  onDelete,
  onClose,
}: {
  open: boolean;
  name: string;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Delete ${name}?`}
      description="The dashboard and its layout go for good. The reports on it stay on the Reports screen."
      width="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            Delete dashboard
          </Button>
        </>
      }
    />
  );
}

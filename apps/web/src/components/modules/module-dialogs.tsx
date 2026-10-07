import type { AdminModule } from '@bemmoly/shared';
import { Button, Field, Input, Modal } from '@bemmoly/ui';
import { FormError } from '../form.tsx';

interface DisableModuleModalProps {
  module: AdminModule | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DisableModuleModal({ module, busy, onClose, onConfirm }: DisableModuleModalProps) {
  if (!module) return null;
  const name = module.name;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Disable ${name}?`}
      description="Its data is kept. Enable it again at any time to pick up where you left off."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={onConfirm}>
            Disable {name}
          </Button>
        </>
      }
    >
      <p className="m-0 text-13 leading-body text-tx-body">
        {name} disappears from the navigation for everyone and its pages stop answering. Its tables,
        files and history stay in the database untouched. Removing that data is a separate step.
      </p>
    </Modal>
  );
}

interface RemoveDataModalProps {
  module: AdminModule | null;
  typed: string;
  canRemove: boolean;
  busy: boolean;
  error: unknown;
  onTyped: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function RemoveDataModal({
  module,
  typed,
  canRemove,
  busy,
  error,
  onTyped,
  onClose,
  onConfirm,
}: RemoveDataModalProps) {
  if (!module) return null;
  const name = module.name;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Remove ${name} data?`}
      description="This deletes the module's tables and files. It cannot be undone from here."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={!canRemove} loading={busy} onClick={onConfirm}>
            Remove data
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (canRemove) onConfirm();
        }}
      >
        <p className="m-0 text-13 leading-body text-tx-body">
          Every issue, page or record {name} holds is deleted, and the action is written to the
          audit log. Take a backup first if you might want it back: restoring that backup is the
          only way to recover it.
        </p>
        {module.enabled ? (
          <p className="m-0 text-12h text-danger">Disable {name} before removing its data.</p>
        ) : null}
        <Field label={`Type ${module.id} to confirm`}>
          <Input
            mono
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(event) => onTyped(event.target.value)}
          />
        </Field>
        <FormError error={error} />
      </form>
    </Modal>
  );
}

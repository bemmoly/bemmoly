import { formatDateTime } from '@bemmoly/core-web';
import type { Backup } from '@bemmoly/shared';
import { Button, Field, Input, Modal } from '@bemmoly/ui';
import { FormError } from '../form.tsx';

interface RestoreModalProps {
  backup: Backup | null;
  typed: string;
  canRestore: boolean;
  busy: boolean;
  error: unknown;
  onTyped: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

/** Restore replaces the live workspace, so the admin types the backup id back. */
export function RestoreModal({
  backup,
  typed,
  canRestore,
  busy,
  error,
  onTyped,
  onClose,
  onConfirm,
}: RestoreModalProps) {
  if (!backup) return null;
  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title={`Restore ${backup.id}?`}
      description={`Taken ${formatDateTime(backup.startedAt)} on version ${backup.appVersion}.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={!canRestore} loading={busy} onClick={onConfirm}>
            Restore this backup
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (canRestore) onConfirm();
        }}
      >
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-13 leading-body text-tx-body">
          <li>
            Bemmoly switches to maintenance mode: nobody can use it until the restore finishes.
          </li>
          <li>
            The backup is restored into a fresh database and swapped in. Everything written since{' '}
            {formatDateTime(backup.startedAt)} is no longer in the live workspace.
          </li>
          <li>
            The database it replaces is kept for the retention window, so you can go back to it.
          </li>
          <li>
            If this backup is from an older version than the one running, Bemmoly runs the pending
            changesets after the restore, bringing the data up to date.
          </li>
        </ul>
        <Field label={`Type ${backup.id} to confirm`}>
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

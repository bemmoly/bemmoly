import type { UpdateStatus } from '@bemmoly/shared';
import { Button, Modal } from '@bemmoly/ui';
import { rollbackCopy, updateModeCopy } from '../../hooks/use-updates-copy.ts';
import { LINK_ACTION } from '../actions.ts';
import { FormError, Notice } from '../form.tsx';

interface DialogProps {
  status: UpdateStatus;
  busy: boolean;
  error: unknown;
  onClose: () => void;
  onConfirm: () => void;
}

export function UpdateModal({ status, busy, error, onClose, onConfirm }: DialogProps) {
  const release = status.latest;
  if (!release) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Update to ${release.version}?`}
      description={`From ${status.currentVersion}, on the ${status.channel} channel.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={onConfirm}>
            Update to {release.version}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <p className="m-0 text-13 leading-body text-tx-body">{updateModeCopy(status.mode)}</p>
        {release.irreversible ? (
          <Notice tone="caution">
            Rolling back from {release.version} would need a restore of the pre-update backup.
          </Notice>
        ) : null}
        <FormError error={error} />
      </div>
    </Modal>
  );
}

interface RollbackModalProps extends DialogProps {
  /** The CSV of audit rows a restore rollback would discard. */
  exportUrl: (since: string) => string;
}

export function RollbackModal({
  status,
  busy,
  error,
  onClose,
  onConfirm,
  exportUrl,
}: RollbackModalProps) {
  const previous = status.previous;
  if (!previous) return null;
  const copy = rollbackCopy(previous);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Roll back to ${previous.version}?`}
      description={copy.mode}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant={copy.exportSince ? 'danger' : 'primary'}
            loading={busy}
            onClick={onConfirm}
          >
            Roll back to {previous.version}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <p className="m-0 text-13 leading-body text-tx-body">{copy.body}</p>
        {copy.exportSince ? (
          <a className={`text-13 ${LINK_ACTION}`} href={exportUrl(copy.exportSince)} download>
            Export the audit rows for those changes first
          </a>
        ) : null}
        <FormError error={error} />
      </div>
    </Modal>
  );
}

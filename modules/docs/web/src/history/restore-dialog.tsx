import { formatDateTime } from '@bemmoly/core-web';
import type { RevisionSummary } from '@bemmoly/module-docs/shared';
import { ConfirmDialog } from '../comments/confirm-dialog.tsx';
import { revisionName } from './use-history.ts';

export interface RestoreDialogProps {
  revision: RevisionSummary | null;
  busy: boolean;
  onConfirm: (revision: RevisionSummary) => void;
  onClose: () => void;
}

/** Restore asks first and says exactly what happens: live for everyone, and kept in history. */
export function RestoreDialog({ revision, busy, onConfirm, onClose }: RestoreDialogProps) {
  return (
    <ConfirmDialog
      open={revision !== null}
      title={revision ? `Restore “${revisionName(revision)}”?` : 'Restore this version?'}
      confirmLabel="Restore"
      busy={busy}
      onClose={onClose}
      onConfirm={() => revision && onConfirm(revision)}
    >
      {revision && (
        <>
          <p className="m-0">
            The page goes back to how it read on {formatDateTime(revision.createdAt)}.
          </p>
          <p className="m-0">
            Everyone with the page open sees the change straight away, in the editor they have open.
            The restore is saved as a new version, so the page as it reads now stays in the history
            and can be restored again.
          </p>
        </>
      )}
    </ConfirmDialog>
  );
}

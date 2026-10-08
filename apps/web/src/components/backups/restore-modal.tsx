import { formatBytes, formatDateTime } from '@bemmoly/core-web';
import type { Backup } from '@bemmoly/shared';
import { ConfirmChange } from '@bemmoly/ui';
import { FormError } from '../form.tsx';
import { KIND } from './backup-labels.ts';

interface RestoreModalProps {
  backup: Backup | null;
  /** How long the replaced database is kept (the pre-update retention). */
  keepDays: number;
  busy: boolean;
  error: unknown;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Restore replaces the live workspace, so the dialog says exactly what happens, in order,
 * and the admin types "restore" before it starts.
 */
export function RestoreModal({
  backup,
  keepDays,
  busy,
  error,
  onClose,
  onConfirm,
}: RestoreModalProps) {
  if (!backup) return null;
  const when = formatDateTime(backup.createdAt);
  return (
    <ConfirmChange
      open
      title={`Restore the backup from ${when}?`}
      description="This replaces the live workspace with the backup."
      consequences={[
        'Bemmoly switches to maintenance mode. Nobody can sign in or work until the restore finishes; it usually takes a few minutes.',
        `Your current data is set aside first: the live database is kept as a fallback copy for ${keepDays} days, so the restore can be undone.`,
        `Everything written since ${when} (work, comments, settings and people) is no longer in the live workspace.`,
        'If the backup is from an older version, Bemmoly then brings its data up to the running version.',
      ]}
      confirmWord="restore"
      confirmLabel="Restore this backup"
      busy={busy}
      error={<FormError error={error} />}
      onCancel={onClose}
      onConfirm={onConfirm}
    >
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-panel border border-br2 bg-sf2 px-3 py-2.5 text-12h">
        <dt className="text-tx4">Backup</dt>
        <dd className="m-0 text-tx2">
          {KIND[backup.kind]} · {formatBytes(backup.sizeBytes)} · version{' '}
          <span className="font-mono text-12">{backup.appVersion}</span>
        </dd>
        <dt className="text-tx4">Id</dt>
        <dd className="m-0 truncate font-mono text-12 text-tx2 select-all">{backup.id}</dd>
      </dl>
    </ConfirmChange>
  );
}

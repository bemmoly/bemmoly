import { formatDateTime, formatRelative } from '@bemmoly/core-web';
import type { UpdateStatus } from '@bemmoly/shared';
import { Button, SettingsRow, SettingsSection } from '@bemmoly/ui';
import { rollbackCopy } from '../../hooks/use-updates-copy.ts';

type Previous = NonNullable<UpdateStatus['previous']>;

interface RollbackCardProps {
  status: UpdateStatus;
  previous: Previous;
  busy: boolean;
  onRollback: () => void;
}

export function RollbackCard({ status, previous, busy, onRollback }: RollbackCardProps) {
  const copy = rollbackCopy(previous);
  return (
    <SettingsSection
      title="Roll back"
      hint={`available until ${formatDateTime(previous.availableUntil)}`}
      layout="rows"
    >
      <SettingsRow
        title={`Updated to ${status.currentVersion} ${formatRelative(previous.updatedAt)}`}
        description={`${copy.mode}: ${copy.body}`}
        control={
          status.mode === 'in_app' ? (
            <Button disabled={busy} onClick={onRollback}>
              Roll back to {previous.version}
            </Button>
          ) : null
        }
      />
      {status.mode === 'in_app' ? null : (
        <p className="m-0 py-2.5 text-12h leading-body text-tx4">
          Run the rollback where you installed Bemmoly:{' '}
          <span className="font-mono text-12">bemmoly rollback</span> on the server, or{' '}
          <span className="font-mono text-12">helm rollback</span> on Kubernetes. Both print the
          same mode and what it loses before they ask you to confirm.
        </p>
      )}
    </SettingsSection>
  );
}

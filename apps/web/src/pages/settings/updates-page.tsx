import { Card } from '@bemmoly/ui';
import { Notice } from '../../components/form.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { ReleaseCard } from '../../components/updates/release-card.tsx';
import { RollbackCard } from '../../components/updates/rollback-card.tsx';
import { RollbackModal, UpdateModal } from '../../components/updates/update-dialogs.tsx';
import { VersionCard } from '../../components/updates/version-card.tsx';
import { useUpdates } from '../../hooks/use-updates.ts';

export function UpdatesPage() {
  const updates = useUpdates();
  const { status, dialog } = updates;
  const job = status?.job;
  return (
    <SettingsPage
      title="Updates"
      description="Every module ships in the image, so one update moves the whole workspace forward. A backup is taken first, and rollback stays available for seven days."
      loading={updates.isPending}
      error={updates.error}
    >
      {status ? (
        <>
          {job ? (
            <div role="status">
              <Notice tone={job.state === 'failed' ? 'caution' : 'accent'}>{job.message}</Notice>
            </div>
          ) : null}
          <VersionCard
            status={status}
            channel={updates.channel}
            checkDaily={updates.checkDaily}
            saving={updates.savingSettings}
            checking={updates.check.isPending}
            onChannel={updates.setChannel}
            onCheckDaily={updates.setCheckDaily}
            onCheck={() => updates.check.mutate()}
          />
          {status.latest ? (
            <ReleaseCard
              status={status}
              release={status.latest}
              busy={updates.busy}
              onUpdate={() => dialog.open('update')}
            />
          ) : (
            <Card className="px-4 py-3 text-13 text-tx3">
              You are on the latest {status.channel} release.
            </Card>
          )}
          {status.previous ? (
            <RollbackCard
              status={status}
              previous={status.previous}
              busy={updates.busy}
              onRollback={() => dialog.open('rollback')}
            />
          ) : null}
          {dialog.kind === 'update' ? (
            <UpdateModal
              status={status}
              busy={updates.apply.isPending}
              error={updates.apply.error}
              onClose={dialog.close}
              onConfirm={() => status.latest && updates.apply.mutate(status.latest.version)}
            />
          ) : null}
          {dialog.kind === 'rollback' ? (
            <RollbackModal
              status={status}
              busy={updates.rollback.isPending}
              error={updates.rollback.error}
              exportUrl={updates.auditExportUrl}
              onClose={dialog.close}
              onConfirm={() => updates.rollback.mutate()}
            />
          ) : null}
        </>
      ) : null}
    </SettingsPage>
  );
}

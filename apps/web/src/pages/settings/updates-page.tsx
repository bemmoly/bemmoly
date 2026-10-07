import { Card } from '@bemmoly/ui';
import { Notice } from '../../components/form.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { MaintenanceNotice } from '../../components/system/maintenance-notice.tsx';
import { CommandBlock, ReleaseCard } from '../../components/updates/release-card.tsx';
import { RollbackCard } from '../../components/updates/rollback-card.tsx';
import { RollbackModal, UpdateModal } from '../../components/updates/update-dialogs.tsx';
import { VersionCard } from '../../components/updates/version-card.tsx';
import { useUpdates } from '../../hooks/use-updates.ts';

export function UpdatesPage() {
  const updates = useUpdates();
  const { overview, dialog, maintenance } = updates;
  const updater = overview?.updater;
  const busy = updates.running || maintenance.active;
  return (
    <SettingsPage
      title="Updates"
      description="Every module ships in the image, so one update moves the whole workspace forward. A backup is taken first, and rollback stays available for seven days."
      loading={updates.isPending}
      error={updates.error}
    >
      {overview && updater ? (
        <>
          <MaintenanceNotice active={maintenance.active} message={maintenance.message} />
          {updater.state === 'running' ? (
            <div role="status">
              <Notice>
                The updater is working{updater.step ? `: ${updater.step}` : ''}. This page checks
                every few seconds.
              </Notice>
            </div>
          ) : null}
          {updater.state === 'failed' ? (
            <Notice tone="caution">
              The last update or rollback failed{updater.step ? ` at the ${updater.step} step` : ''}
              . The server kept or restored the previous version; check the audit log for details.
            </Notice>
          ) : null}
          {updater.state === 'unreachable' ? (
            <div className="flex flex-col gap-2">
              <Notice tone="caution">
                The updater is not answering, so updates cannot start from here. Run this on the
                server instead:
              </Notice>
              <CommandBlock command={updater.command} />
            </div>
          ) : null}
          {overview.checks.error ? (
            <Notice tone="caution">The last release check failed: {overview.checks.error}</Notice>
          ) : null}
          <VersionCard
            overview={overview}
            channel={updates.channel}
            checkDaily={updates.checkDaily}
            saving={updates.savingSettings}
            refreshing={updates.isRefetching}
            uploading={updates.upload.isPending}
            onChannel={updates.setChannel}
            onCheckDaily={updates.setCheckDaily}
            onRefresh={() => void updates.refetch()}
            onUpload={(file) => updates.upload.mutate(file)}
          />
          {overview.available ? (
            <ReleaseCard
              overview={overview}
              release={overview.available}
              busy={busy}
              onUpdate={() => dialog.open('update')}
            />
          ) : (
            <Card className="px-4 py-3 text-13 text-tx3">
              You are on the latest {overview.current.channel} release.
            </Card>
          )}
          {overview.rollback ? (
            <RollbackCard
              overview={overview}
              plan={overview.rollback}
              busy={busy}
              onRollback={() => dialog.open('rollback')}
            />
          ) : null}
          {dialog.kind === 'update' ? (
            <UpdateModal
              overview={overview}
              busy={updates.apply.isPending}
              error={updates.applyError}
              cliCommand={updates.cliCommand}
              onClose={dialog.close}
              onConfirm={() =>
                overview.available && updates.apply.mutate(overview.available.version)
              }
            />
          ) : null}
          {dialog.kind === 'rollback' && overview.rollback ? (
            <RollbackModal
              plan={overview.rollback}
              busy={updates.rollback.isPending}
              error={updates.rollback.error}
              planChanged={updates.planChanged}
              exportUrl={updates.auditExportUrl}
              onClose={dialog.close}
              onConfirm={() => overview.rollback && updates.rollback.mutate(overview.rollback.mode)}
            />
          ) : null}
        </>
      ) : null}
    </SettingsPage>
  );
}

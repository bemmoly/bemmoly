import { Button } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { BackupSettings } from '../../components/backups/backup-settings.tsx';
import { BackupStatus } from '../../components/backups/backup-status.tsx';
import { BackupsTable } from '../../components/backups/backups-table.tsx';
import { RestoreModal } from '../../components/backups/restore-modal.tsx';
import { RestorePicker } from '../../components/backups/restore-picker.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { MaintenanceNotice } from '../../components/system/maintenance-notice.tsx';
import { bucketFromLocations } from '../../hooks/use-backups-risks.ts';
import { useBackupSchedule } from '../../hooks/use-backups-schedule.ts';
import { statusLine, useBackups } from '../../hooks/use-backups.ts';

export function BackupsPage() {
  const list = useBackups();
  const form = useBackupSchedule();
  const dialog = list.restoreDialog;
  const paused = list.maintenance.active;
  const offBox = form.s3Configured;
  const locations = list.backups.flatMap((backup) => backup.locations);
  const localPath =
    locations.find((location) => location.destination === 'local')?.location ?? null;
  const bucket = bucketFromLocations(locations.map((location) => location.location));
  const keepDays = form.stored?.retention.preUpgradeDays ?? 7;
  const busyId = list.verify.isPending ? (list.verify.variables?.id ?? null) : null;
  return (
    <SettingsPage
      title="Storage and backups"
      description="When Bemmoly backs up, how long it keeps each backup, and where the copies go."
      loading={list.isPending || form.settings.isPending}
      error={list.error ?? form.settings.error}
      actions={
        <>
          <Button
            icon={<Icon name="restore" />}
            disabled={paused}
            onClick={list.restorePicker.show}
          >
            Restore…
          </Button>
          <Button
            variant="primary"
            disabled={paused}
            loading={list.run.isPending}
            onClick={() => list.run.mutate()}
          >
            Back up now
          </Button>
        </>
      }
    >
      <MaintenanceNotice active={paused} message={list.maintenance.message} />
      <BackupStatus
        parts={statusLine(list.backups, form.stored?.schedule, offBox)}
        oneDisk={!offBox}
      />
      <BackupSettings form={form} localPath={localPath} bucket={bucket} paused={paused} />
      <BackupsTable
        backups={list.backups}
        hasMore={list.hasNextPage}
        loadingMore={list.isFetchingNextPage}
        onLoadMore={() => void list.fetchNextPage()}
        busyId={busyId}
        paused={paused}
        keepDays={keepDays}
        onCheck={(id) => list.verify.mutate({ id, depth: 'list' })}
        onDrill={(id) => list.verify.mutate({ id, depth: 'restore' })}
        onRestore={dialog.open}
        downloadUrl={list.downloadUrl}
      />
      <RestorePicker
        open={list.restorePicker.open}
        backups={list.restorable}
        onClose={list.restorePicker.close}
        onPick={dialog.open}
      />
      <RestoreModal
        backup={dialog.target}
        keepDays={keepDays}
        busy={list.restore.isPending}
        error={list.restore.error}
        onClose={dialog.close}
        onConfirm={() => dialog.target && list.restore.mutate(dialog.target.id)}
      />
    </SettingsPage>
  );
}

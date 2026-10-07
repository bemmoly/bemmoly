import { Button } from '@bemmoly/ui';
import { BackupStatus } from '../../components/backups/backup-status.tsx';
import { BackupsTable } from '../../components/backups/backups-table.tsx';
import { DestinationsCard } from '../../components/backups/destinations-card.tsx';
import { RestoreModal } from '../../components/backups/restore-modal.tsx';
import {
  ProtectionCard,
  RetentionCard,
  ScheduleCard,
} from '../../components/backups/schedule-cards.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { MaintenanceNotice } from '../../components/system/maintenance-notice.tsx';
import { PageBlock } from '../../components/system/page-block.tsx';
import { useBackupSchedule } from '../../hooks/use-backups-schedule.ts';
import { statusLine, useBackups } from '../../hooks/use-backups.ts';
import { TIMEZONES } from '../../hooks/use-workspace-settings.ts';

export function BackupsPage() {
  const list = useBackups();
  const form = useBackupSchedule();
  const policy = form.policy;
  const dialog = list.restoreDialog;
  const paused = list.maintenance.active;
  const offBox = form.s3Configured;
  const localPath =
    list.backups[0]?.locations.find((location) => location.destination === 'local')?.location ??
    null;
  const busyId = list.verify.isPending ? (list.verify.variables?.id ?? null) : null;
  return (
    <SettingsPage
      title="Storage and backups"
      description="When Bemmoly backs up, how long it keeps each backup, and where the copies go."
      loading={list.isPending || form.settings.isPending}
      error={list.error ?? form.settings.error}
      actions={
        <Button
          variant="primary"
          disabled={paused}
          loading={list.run.isPending}
          onClick={() => list.run.mutate()}
        >
          Back up now
        </Button>
      }
    >
      <MaintenanceNotice active={paused} message={list.maintenance.message} />
      <BackupStatus parts={statusLine(list.backups, policy?.schedule, offBox)} oneDisk={!offBox} />
      {policy ? (
        <form
          id="backup-settings"
          className="flex flex-col gap-4"
          onSubmit={form.submit}
          noValidate
        >
          <ScheduleCard
            policy={policy}
            update={form.update}
            errors={form.errors}
            timezones={TIMEZONES}
          />
          <RetentionCard policy={policy} update={form.update} errors={form.errors} />
          <DestinationsCard
            localPath={localPath}
            configured={form.s3Configured}
            s3={form.s3}
            errors={form.errors}
            onStart={form.startS3}
            onEdit={form.editS3}
            onRemove={form.removeS3}
            onKeep={form.keepS3}
          />
          <ProtectionCard policy={policy} update={form.update} />
          <div className="flex justify-end gap-2">
            <Button disabled={!form.dirty} onClick={form.discard}>
              Discard
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!form.dirty || paused}
              loading={form.settings.save.isPending}
            >
              Save
            </Button>
          </div>
        </form>
      ) : null}
      <PageBlock id="backups-heading" title="Backups">
        <BackupsTable
          backups={list.backups}
          hasMore={list.hasNextPage}
          loadingMore={list.isFetchingNextPage}
          onLoadMore={() => void list.fetchNextPage()}
          busyId={busyId}
          paused={paused}
          onCheck={(id) => list.verify.mutate({ id, depth: 'list' })}
          onDrill={(id) => list.verify.mutate({ id, depth: 'restore' })}
          onRestore={dialog.open}
          downloadUrl={list.downloadUrl}
        />
      </PageBlock>
      <RestoreModal
        backup={dialog.target}
        typed={dialog.typed}
        canRestore={dialog.canRestore}
        busy={list.restore.isPending}
        error={list.restore.error}
        onTyped={dialog.setTyped}
        onClose={dialog.close}
        onConfirm={() => dialog.target && list.restore.mutate(dialog.target.id)}
      />
    </SettingsPage>
  );
}

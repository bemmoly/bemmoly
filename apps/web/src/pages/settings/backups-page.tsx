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
import { PageBlock } from '../../components/system/page-block.tsx';
import { useBackupSchedule } from '../../hooks/use-backups-schedule.ts';
import { statusLine, useBackups } from '../../hooks/use-backups.ts';
import { TIMEZONES } from '../../hooks/use-workspace-settings.ts';

export function BackupsPage() {
  const list = useBackups();
  const form = useBackupSchedule();
  const schedule = form.schedule;
  const dialog = list.restoreDialog;
  return (
    <SettingsPage
      title="Storage and backups"
      description="When Bemmoly backs up, how long it keeps each backup, and where the copies go."
      loading={list.isPending || form.settings.isPending}
      error={list.error ?? form.settings.error}
      actions={
        <Button variant="primary" loading={list.run.isPending} onClick={() => list.run.mutate()}>
          Back up now
        </Button>
      }
    >
      <BackupStatus
        parts={statusLine(list.summary, list.backups, schedule?.timezone ?? 'UTC')}
        oneDisk={list.summary?.oneDisk ?? false}
      />
      {schedule ? (
        <form
          id="backup-settings"
          className="flex flex-col gap-4"
          onSubmit={form.submit}
          noValidate
        >
          <ScheduleCard
            schedule={schedule}
            update={form.update}
            errors={form.errors}
            timezones={TIMEZONES}
          />
          <RetentionCard schedule={schedule} update={form.update} errors={form.errors} />
          <DestinationsCard
            schedule={schedule}
            update={form.update}
            setBucket={form.setBucket}
            secrets={form.secrets}
            stored={form.stored}
            setSecret={form.setSecret}
            errors={form.errors}
          />
          <ProtectionCard schedule={schedule} update={form.update} />
          <div className="flex justify-end gap-2">
            <Button disabled={!form.dirty} onClick={form.discard}>
              Discard
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!form.dirty}
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
          drillingId={list.verify.isPending ? (list.verify.variables ?? null) : null}
          onDrill={(id) => list.verify.mutate(id)}
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

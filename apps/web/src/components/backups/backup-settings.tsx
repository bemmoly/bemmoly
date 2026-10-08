import { ConfirmChange, SettingsSection, UnsavedChangesBar } from '@bemmoly/ui';
import { destinationRisk, protectionRisk, retentionRisk } from '../../hooks/use-backups-risks.ts';
import type { BackupSection, useBackupSchedule } from '../../hooks/use-backups-schedule.ts';
import { TIMEZONES } from '../../hooks/use-workspace-settings.ts';
import { useConfirmChange } from '../settings/use-confirm-change.ts';
import { useSectionEdits } from '../settings/use-section-edits.ts';
import {
  DestinationValues,
  ProtectionValues,
  RetentionValues,
  ScheduleValues,
} from './backup-values.tsx';
import { DestinationFields } from './destinations-card.tsx';
import { ProtectionFields, RetentionFields, ScheduleFields } from './schedule-cards.tsx';

interface BackupSettingsProps {
  form: ReturnType<typeof useBackupSchedule>;
  /** Where the newest backup's local copy sits. */
  localPath: string | null;
  /** The bucket the newest backup went to, for the read view and the removal check. */
  bucket: string | null;
  /** Writes are paused while the server is in maintenance. */
  paused: boolean;
}

const TITLES: Record<BackupSection, string> = {
  schedule: 'Schedule',
  retention: 'Retention',
  destinations: 'Destinations',
  protection: 'Encryption and verification',
};

/**
 * The four policy sections of Storage and backups in the read-then-edit pattern: each opens
 * with Edit, saves on its own, and asks first when a change can lose backups.
 */
export function BackupSettings({ form, localPath, bucket, paused }: BackupSettingsProps) {
  const confirm = useConfirmChange();
  const spec = (id: BackupSection) => ({
    title: TITLES[id],
    dirty: form.dirty[id],
    discard: () => form.discard(id),
  });
  const edits = useSectionEdits({
    schedule: spec('schedule'),
    retention: spec('retention'),
    destinations: spec('destinations'),
    protection: spec('protection'),
  });
  const { stored, policy } = form;
  if (!stored || !policy) return null;

  const save = (id: BackupSection) => {
    const values = form.prepare(id);
    if (!values) return;
    const risk =
      id === 'retention'
        ? retentionRisk(stored.retention, policy.retention)
        : id === 'destinations'
          ? destinationRisk(form.s3Configured, form.s3, bucket)
          : id === 'protection'
            ? protectionRisk(stored, policy)
            : null;
    confirm.request(risk, () => form.save(id, values, () => edits.close(id)));
  };
  const section = (id: BackupSection) => ({
    ...edits.section(id),
    onSave: () => save(id),
    saving: form.saving === id,
    ...(paused ? { locked: 'Paused while Bemmoly is in maintenance' } : {}),
  });
  const reading = (id: BackupSection) => edits.mode(id) === 'read';

  return (
    <>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <SettingsSection
          {...section('schedule')}
          hint="Bemmoly also backs up before every update"
          layout={reading('schedule') ? 'rows' : 'block'}
        >
          {reading('schedule') ? (
            <ScheduleValues schedule={policy.schedule} />
          ) : (
            <ScheduleFields
              schedule={policy.schedule}
              update={form.updateSchedule}
              errors={form.errors}
              timezones={TIMEZONES}
            />
          )}
        </SettingsSection>
        <SettingsSection
          {...section('retention')}
          hint="How many of each to keep"
          layout={reading('retention') ? 'rows' : 'block'}
          {...(reading('retention')
            ? {}
            : { note: 'Lowering a number deletes older backups at the next prune.' })}
        >
          {reading('retention') ? (
            <RetentionValues retention={policy.retention} />
          ) : (
            <RetentionFields
              retention={policy.retention}
              update={form.updateRetention}
              errors={form.errors}
            />
          )}
        </SettingsSection>
        <SettingsSection {...section('destinations')}>
          {reading('destinations') ? (
            <DestinationValues
              localPath={localPath}
              configured={form.s3Configured}
              bucket={bucket}
            />
          ) : (
            <DestinationFields
              localPath={localPath}
              configured={form.s3Configured}
              s3={form.s3}
              errors={form.errors}
              onStart={form.startS3}
              onEdit={form.editS3}
              onRemove={form.removeS3}
              onKeep={form.keepS3}
            />
          )}
        </SettingsSection>
        <SettingsSection {...section('protection')} layout="rows">
          {reading('protection') ? (
            <ProtectionValues {...policy} />
          ) : (
            <ProtectionFields
              protection={{ encryption: policy.encryption, verification: policy.verification }}
              update={form.updateProtection}
            />
          )}
        </SettingsSection>
      </div>
      <ConfirmChange {...confirm.dialog} />
      <UnsavedChangesBar {...edits.bar} />
    </>
  );
}

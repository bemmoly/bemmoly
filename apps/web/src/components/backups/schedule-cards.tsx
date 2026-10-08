import type { BackupRetentionSettings, BackupScheduleSettings } from '@bemmoly/shared';
import { Field, Input, Select, SettingsRow, Switch } from '@bemmoly/ui';
import type { BackupProtection } from '../../hooks/use-backups-schedule.ts';
import type { FieldErrors } from '../../lib/errors.ts';

export const FREQUENCIES = [
  { value: 'hourly', label: 'Every hour' },
  { value: '6h', label: 'Every 6 hours' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
].map((label, day) => ({ value: String(day), label }));

export const TIERS = [
  { key: 'hourly', label: 'Hourly', min: 0, max: 168 },
  { key: 'daily', label: 'Daily', min: 0, max: 365 },
  { key: 'weekly', label: 'Weekly', min: 0, max: 104 },
  { key: 'monthly', label: 'Monthly', min: 0, max: 120 },
  { key: 'preUpgradeDays', label: 'Pre-update, days', min: 1, max: 90 },
] as const;

const wholeNumber = (value: string) => Math.max(0, Math.trunc(Number(value) || 0));

interface ScheduleFieldsProps {
  schedule: BackupScheduleSettings;
  update: (patch: Partial<BackupScheduleSettings>) => void;
  errors: FieldErrors;
  timezones: readonly string[];
}

/** Editing the Schedule section: frequency, the weekday for weekly, time and timezone. */
export function ScheduleFields({ schedule, update, errors, timezones }: ScheduleFieldsProps) {
  const hourly = schedule.frequency === 'hourly';
  return (
    <div className="grid grid-cols-2 gap-3.5">
      <Field label="Frequency">
        <Select
          options={FREQUENCIES}
          value={schedule.frequency}
          onChange={(event) =>
            update({ frequency: event.target.value as BackupScheduleSettings['frequency'] })
          }
        />
      </Field>
      {schedule.frequency === 'weekly' ? (
        <Field label="Day">
          <Select
            options={WEEKDAYS}
            value={String(schedule.weekday)}
            onChange={(event) => update({ weekday: Number(event.target.value) })}
          />
        </Field>
      ) : null}
      <Field
        label="Time"
        hint={hourly ? 'Not used for hourly backups.' : undefined}
        error={errors['schedule.time']}
      >
        <Input
          type="time"
          mono
          disabled={hourly}
          value={schedule.time}
          onChange={(event) => update({ time: event.target.value })}
        />
      </Field>
      <Field label="Timezone" error={errors['schedule.timezone']}>
        <Select
          options={timezones.map((zone) => ({ value: zone, label: zone }))}
          value={schedule.timezone}
          onChange={(event) => update({ timezone: event.target.value })}
        />
      </Field>
    </div>
  );
}

interface RetentionFieldsProps {
  retention: BackupRetentionSettings;
  update: (patch: Partial<BackupRetentionSettings>) => void;
  errors: FieldErrors;
}

/** Editing the Retention section: how many of each tier to keep. */
export function RetentionFields({ retention, update, errors }: RetentionFieldsProps) {
  return (
    <div className="grid grid-cols-3 gap-3.5">
      {TIERS.map((tier) => (
        <Field key={tier.key} label={tier.label} error={errors[`retention.${tier.key}`]}>
          <Input
            type="number"
            mono
            min={tier.min}
            max={tier.max}
            value={String(retention[tier.key])}
            onChange={(event) => update({ [tier.key]: wholeNumber(event.target.value) })}
          />
        </Field>
      ))}
    </div>
  );
}

interface ProtectionFieldsProps {
  protection: BackupProtection;
  update: (patch: Partial<BackupProtection>) => void;
}

export const ENCRYPT_COPY =
  'AES-256-GCM with the backup passphrase in .env. Copies sent to a bucket are always encrypted.';
export const TEST_RESTORE_COPY =
  'Every dump is checked on write. The test restore also compares row counts in a temporary database.';

/** Editing Encryption and verification. */
export function ProtectionFields({ protection, update }: ProtectionFieldsProps) {
  return (
    <>
      <SettingsRow
        title="Encrypt the local copy"
        description={ENCRYPT_COPY}
        control={
          <Switch
            aria-label="Encrypt the local copy"
            checked={protection.encryption.local}
            onCheckedChange={(local) => update({ encryption: { local } })}
          />
        }
      />
      <SettingsRow
        title="Weekly test restore"
        description={TEST_RESTORE_COPY}
        control={
          <Switch
            aria-label="Weekly test restore"
            checked={protection.verification.testRestore === 'weekly'}
            onCheckedChange={(on) =>
              update({ verification: { testRestore: on ? 'weekly' : 'off' } })
            }
          />
        }
      />
    </>
  );
}

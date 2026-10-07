import type { BackupSchedule } from '@bemmoly/shared';
import { Field, Input, Select, SettingsRow, SettingsSection, Switch } from '@bemmoly/ui';
import type { FieldErrors } from '../../lib/errors.ts';

const FREQUENCIES = [
  { value: 'hourly', label: 'Every hour' },
  { value: 'every_6_hours', label: 'Every 6 hours' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

const VERIFICATION = [
  { value: 'weekly', label: 'Weekly test restore' },
  { value: 'daily', label: 'Daily test restore' },
  { value: 'off', label: 'Off' },
];

const TIERS = [
  { key: 'hourly', label: 'Hourly', max: 168 },
  { key: 'daily', label: 'Daily', max: 365 },
  { key: 'weekly', label: 'Weekly', max: 104 },
  { key: 'monthly', label: 'Monthly', max: 120 },
] as const;

export interface ScheduleCardProps {
  schedule: BackupSchedule;
  update: (patch: Partial<BackupSchedule>) => void;
  errors: FieldErrors;
}

export function ScheduleCard({
  schedule,
  update,
  errors,
  timezones,
}: ScheduleCardProps & { timezones: readonly string[] }) {
  return (
    <SettingsSection title="Schedule" hint="Backups also run before every update">
      <div className="grid grid-cols-3 gap-3.5">
        <Field label="Frequency">
          <Select
            options={FREQUENCIES}
            value={schedule.frequency}
            onChange={(event) =>
              update({ frequency: event.target.value as BackupSchedule['frequency'] })
            }
          />
        </Field>
        <Field label="Time" error={errors['timeOfDay']}>
          <Input
            type="time"
            mono
            value={schedule.timeOfDay}
            onChange={(event) => update({ timeOfDay: event.target.value })}
          />
        </Field>
        <Field label="Timezone" error={errors['timezone']}>
          <Select
            options={timezones.map((zone) => ({ value: zone, label: zone }))}
            value={schedule.timezone}
            onChange={(event) => update({ timezone: event.target.value })}
          />
        </Field>
      </div>
    </SettingsSection>
  );
}

export function RetentionCard({ schedule, update, errors }: ScheduleCardProps) {
  return (
    <SettingsSection
      title="Retention"
      hint="How many of each to keep; pre-update backups are kept for seven days"
    >
      <div className="grid grid-cols-4 gap-3.5">
        {TIERS.map((tier) => (
          <Field
            key={tier.key}
            label={tier.label}
            error={errors[`retention.${tier.key}`]}
            hint={schedule.retention[tier.key] === 0 ? 'None kept' : undefined}
          >
            <Input
              type="number"
              mono
              min={0}
              max={tier.max}
              value={String(schedule.retention[tier.key])}
              onChange={(event) =>
                update({
                  retention: {
                    ...schedule.retention,
                    [tier.key]: Math.max(0, Math.trunc(Number(event.target.value) || 0)),
                  },
                })
              }
            />
          </Field>
        ))}
      </div>
    </SettingsSection>
  );
}

export function ProtectionCard({ schedule, update }: Omit<ScheduleCardProps, 'errors'>) {
  const offBox = schedule.s3 !== null;
  return (
    <SettingsSection title="Encryption and verification" layout="rows">
      <SettingsRow
        title="Encrypt backups"
        description={
          offBox
            ? 'Required while a bucket is a destination. AES-256-GCM with the passphrase in .env.'
            : 'AES-256-GCM with the backup passphrase the installer wrote to .env.'
        }
        control={
          <Switch
            aria-label="Encrypt backups"
            checked={offBox || schedule.encryption}
            disabled={offBox}
            onCheckedChange={(encryption) => update({ encryption })}
          />
        }
      />
      <SettingsRow
        title="Verification"
        description="Every dump is checked on write. A test restore also compares row counts in a temporary database."
        control={
          <Select
            aria-label="Verification"
            wrapperClassName="w-52"
            options={VERIFICATION}
            value={schedule.verification}
            onChange={(event) =>
              update({ verification: event.target.value as BackupSchedule['verification'] })
            }
          />
        }
      />
    </SettingsSection>
  );
}

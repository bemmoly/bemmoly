import type { BackupScheduleSettings } from '@bemmoly/shared';
import { Field, Input, Select, SettingsRow, SettingsSection, Switch } from '@bemmoly/ui';
import type { BackupPolicy } from '../../hooks/use-backups-schedule.ts';
import type { FieldErrors } from '../../lib/errors.ts';

const FREQUENCIES = [
  { value: 'hourly', label: 'Every hour' },
  { value: '6h', label: 'Every 6 hours' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
  (label, day) => ({ value: String(day), label }),
);

const TIERS = [
  { key: 'hourly', label: 'Hourly', min: 0, max: 168 },
  { key: 'daily', label: 'Daily', min: 0, max: 365 },
  { key: 'weekly', label: 'Weekly', min: 0, max: 104 },
  { key: 'monthly', label: 'Monthly', min: 0, max: 120 },
  { key: 'preUpgradeDays', label: 'Pre-update, days', min: 1, max: 90 },
] as const;

export interface PolicyCardProps {
  policy: BackupPolicy;
  update: (patch: Partial<BackupPolicy>) => void;
  errors: FieldErrors;
}

const wholeNumber = (value: string) => Math.max(0, Math.trunc(Number(value) || 0));

export function ScheduleCard({
  policy,
  update,
  errors,
  timezones,
}: PolicyCardProps & { timezones: readonly string[] }) {
  const schedule = policy.schedule;
  const set = (patch: Partial<BackupScheduleSettings>) =>
    update({ schedule: { ...schedule, ...patch } });
  const hourly = schedule.frequency === 'hourly';
  return (
    <SettingsSection title="Schedule" hint="Bemmoly also backs up before every update">
      <div
        className={`grid gap-3.5 ${schedule.frequency === 'weekly' ? 'grid-cols-4' : 'grid-cols-3'}`}
      >
        <Field label="Frequency">
          <Select
            options={FREQUENCIES}
            value={schedule.frequency}
            onChange={(event) =>
              set({ frequency: event.target.value as BackupScheduleSettings['frequency'] })
            }
          />
        </Field>
        {schedule.frequency === 'weekly' ? (
          <Field label="Day">
            <Select
              options={WEEKDAYS}
              value={String(schedule.weekday)}
              onChange={(event) => set({ weekday: Number(event.target.value) })}
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
            onChange={(event) => set({ time: event.target.value })}
          />
        </Field>
        <Field label="Timezone" error={errors['schedule.timezone']}>
          <Select
            options={timezones.map((zone) => ({ value: zone, label: zone }))}
            value={schedule.timezone}
            onChange={(event) => set({ timezone: event.target.value })}
          />
        </Field>
      </div>
    </SettingsSection>
  );
}

export function RetentionCard({ policy, update, errors }: PolicyCardProps) {
  const retention = policy.retention;
  return (
    <SettingsSection title="Retention" hint="How many of each to keep">
      <div className="grid grid-cols-5 gap-3.5">
        {TIERS.map((tier) => (
          <Field key={tier.key} label={tier.label} error={errors[`retention.${tier.key}`]}>
            <Input
              type="number"
              mono
              min={tier.min}
              max={tier.max}
              value={String(retention[tier.key])}
              onChange={(event) =>
                update({ retention: { ...retention, [tier.key]: wholeNumber(event.target.value) } })
              }
            />
          </Field>
        ))}
      </div>
    </SettingsSection>
  );
}

export function ProtectionCard({ policy, update }: Omit<PolicyCardProps, 'errors'>) {
  return (
    <SettingsSection title="Encryption and verification" layout="rows">
      <SettingsRow
        title="Encrypt the local copy"
        description="AES-256-GCM with the backup passphrase in .env. Copies sent to a bucket are always encrypted."
        control={
          <Switch
            aria-label="Encrypt the local copy"
            checked={policy.encryption.local}
            onCheckedChange={(local) => update({ encryption: { local } })}
          />
        }
      />
      <SettingsRow
        title="Weekly test restore"
        description="Every dump is checked on write. The test restore also compares row counts in a temporary database."
        control={
          <Switch
            aria-label="Weekly test restore"
            checked={policy.verification.testRestore === 'weekly'}
            onCheckedChange={(on) =>
              update({ verification: { testRestore: on ? 'weekly' : 'off' } })
            }
          />
        }
      />
    </SettingsSection>
  );
}

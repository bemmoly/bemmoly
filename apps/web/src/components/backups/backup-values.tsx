import { SettingsValue, SettingsValues } from '@bemmoly/ui';
import type { BackupPolicy } from '../../hooks/use-backups-schedule.ts';
import { LocalDiskRow } from './destinations-card.tsx';
import { FREQUENCIES, TIERS, WEEKDAYS } from './schedule-cards.tsx';
import { StatePill } from '../settings/state-pill.tsx';

const labelOf = (list: ReadonlyArray<{ value: string; label: string }>, value: string) =>
  list.find((entry) => entry.value === value)?.label ?? value;

/** Schedule, read view. */
export function ScheduleValues({ schedule }: Pick<BackupPolicy, 'schedule'>) {
  const hourly = schedule.frequency === 'hourly';
  return (
    <SettingsValues>
      <SettingsValue label="Frequency">{labelOf(FREQUENCIES, schedule.frequency)}</SettingsValue>
      {schedule.frequency === 'weekly' ? (
        <SettingsValue label="Day">{labelOf(WEEKDAYS, String(schedule.weekday))}</SettingsValue>
      ) : null}
      <SettingsValue label="Time" mono={!hourly} muted={hourly}>
        {hourly ? 'Every hour, on the hour' : schedule.time}
      </SettingsValue>
      <SettingsValue label="Timezone" mono>
        {schedule.timezone}
      </SettingsValue>
    </SettingsValues>
  );
}

/** Retention, read view: how many of each tier are kept. */
export function RetentionValues({ retention }: Pick<BackupPolicy, 'retention'>) {
  return (
    <SettingsValues>
      {TIERS.map((tier) => (
        <SettingsValue
          key={tier.key}
          label={tier.key === 'preUpgradeDays' ? 'Pre-update' : tier.label}
        >
          {tier.key === 'preUpgradeDays'
            ? `${retention.preUpgradeDays} days`
            : `${retention[tier.key]} kept`}
        </SettingsValue>
      ))}
    </SettingsValues>
  );
}

const onOff = (on: boolean) => (on ? 'On' : 'Off');

/** Encryption and verification, read view. */
export function ProtectionValues({
  encryption,
  verification,
}: Pick<BackupPolicy, 'encryption' | 'verification'>) {
  return (
    <SettingsValues>
      <SettingsValue label="Encrypt the local copy" muted={!encryption.local}>
        {onOff(encryption.local)}
      </SettingsValue>
      <SettingsValue label="Weekly test restore" muted={verification.testRestore !== 'weekly'}>
        {onOff(verification.testRestore === 'weekly')}
      </SettingsValue>
    </SettingsValues>
  );
}

interface DestinationValuesProps {
  localPath: string | null;
  configured: boolean;
  /** The bucket named in the newest backup's S3 location, when there is one. */
  bucket: string | null;
}

/** Destinations, read view: the local disk and whether a bucket is set up. */
export function DestinationValues({ localPath, configured, bucket }: DestinationValuesProps) {
  return (
    <>
      <LocalDiskRow localPath={localPath} />
      <div className="flex items-center gap-3 border-t border-br-row pt-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium">S3-compatible bucket</span>
          <span className="text-12 text-tx5">
            {configured
              ? bucket
                ? `A second copy goes to ${bucket}, encrypted.`
                : 'A second copy goes to the bucket, encrypted.'
              : 'Not set up: every backup sits on this machine only.'}
          </span>
        </div>
        <StatePill tone={configured ? 'ok' : 'neutral'}>
          {configured ? 'Configured' : 'Not configured'}
        </StatePill>
      </div>
    </>
  );
}

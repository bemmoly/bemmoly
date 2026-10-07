import { queryKeys } from '@bemmoly/api-client';
import { backupScheduleSchema, type BackupSchedule } from '@bemmoly/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { validateForm, type FieldErrors } from '../lib/errors.ts';
import { useDraft, useSettings, type SettingValues } from './use-setting.ts';

const KEYS = ['backups.schedule', 'backups.s3.accessKeyId', 'backups.s3.secretAccessKey'] as const;
type Key = (typeof KEYS)[number];

/** The tech design's defaults: daily at 02:00, 7 daily · 4 weekly · 3 monthly, local, weekly drill. */
export const DEFAULT_SCHEDULE: BackupSchedule = {
  frequency: 'daily',
  timeOfDay: '02:00',
  timezone: 'UTC',
  retention: { hourly: 0, daily: 7, weekly: 4, monthly: 3 },
  localPath: '/var/bemmoly/backups',
  s3: null,
  encryption: false,
  verification: 'weekly',
};

export const EMPTY_BUCKET = { endpoint: '', bucket: '', region: '', prefix: 'bemmoly/' };

/** Write-only S3 credentials: null keeps the stored one; a string is what the admin typed. */
export interface S3Secrets {
  accessKeyId: string | null;
  secretAccessKey: string | null;
}

const NO_SECRETS: S3Secrets = { accessKeyId: null, secretAccessKey: null };

/**
 * What a save writes. Secrets go only when the admin typed one, so a blank
 * field keeps the stored key. Off-box copies are always encrypted.
 */
export function backupSaveValues(schedule: BackupSchedule, secrets: S3Secrets): SettingValues<Key> {
  const values: SettingValues<Key> = {
    'backups.schedule': schedule.s3 ? { ...schedule, encryption: true } : schedule,
  };
  const keyId = secrets.accessKeyId?.trim();
  if (schedule.s3 && keyId) values['backups.s3.accessKeyId'] = keyId;
  if (schedule.s3 && secrets.secretAccessKey) {
    values['backups.s3.secretAccessKey'] = secrets.secretAccessKey;
  }
  return values;
}

/** Schema errors plus what a bucket destination needs before it can work. */
export function scheduleErrors(
  schedule: BackupSchedule,
  secrets: S3Secrets,
  stored: { accessKeyId: boolean; secretAccessKey: boolean },
): FieldErrors {
  const result = validateForm(backupScheduleSchema, schedule);
  const errors: FieldErrors = { ...(result.errors ?? {}) };
  if (schedule.s3) {
    if (!schedule.s3.bucket.trim()) errors['s3.bucket'] = 'Name the bucket backups go to.';
    if (!stored.accessKeyId && !secrets.accessKeyId?.trim())
      errors['accessKeyId'] = 'Enter the access key id for this bucket.';
    if (!stored.secretAccessKey && !secrets.secretAccessKey)
      errors['secretAccessKey'] = 'Enter the secret access key for this bucket.';
  }
  return errors;
}

/** Settings › Storage and backups: schedule, retention, destinations, encryption, verification. */
export function useBackupSchedule() {
  const queryClient = useQueryClient();
  const settings = useSettings(KEYS, 'Backup settings saved');
  const draft = useDraft<BackupSchedule>(
    settings.reads ? (settings.reads['backups.schedule'].value ?? DEFAULT_SCHEDULE) : undefined,
  );
  const [secrets, setSecrets] = useState<S3Secrets>(NO_SECRETS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const stored = {
    accessKeyId: settings.reads?.['backups.s3.accessKeyId'].isSet ?? false,
    secretAccessKey: settings.reads?.['backups.s3.secretAccessKey'].isSet ?? false,
  };
  const typedSecret = Boolean(secrets.accessKeyId || secrets.secretAccessKey);

  const setBucket = (on: boolean) =>
    draft.update(on ? { s3: draft.value?.s3 ?? EMPTY_BUCKET, encryption: true } : { s3: null });

  const discard = () => {
    draft.discard();
    setSecrets(NO_SECRETS);
    setErrors({});
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.value) return;
    const found = scheduleErrors(draft.value, secrets, stored);
    setErrors(found);
    if (Object.keys(found).length) return;
    settings.save.mutate(backupSaveValues(draft.value, secrets), {
      onSuccess: () => {
        discard();
        // The summary's "one disk" and next run follow the saved schedule.
        void queryClient.invalidateQueries({ queryKey: queryKeys.backups() });
      },
    });
  };

  return {
    settings,
    schedule: draft.value,
    update: draft.update,
    dirty: draft.dirty || typedSecret,
    secrets,
    stored,
    setSecret: (patch: Partial<S3Secrets>) => setSecrets({ ...secrets, ...patch }),
    setBucket,
    errors,
    submit,
    discard,
  };
}

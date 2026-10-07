import { queryKeys } from '@bemmoly/api-client';
import {
  backupEncryptionSettingsSchema,
  backupRetentionSettingsSchema,
  backupS3SettingsSchema,
  backupScheduleSettingsSchema,
  backupVerificationSettingsSchema,
  type BackupEncryptionSettings,
  type BackupRetentionSettings,
  type BackupS3Settings,
  type BackupScheduleSettings,
  type BackupVerificationSettings,
} from '@bemmoly/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { z } from 'zod';
import { validateForm, type FieldErrors } from '../lib/errors.ts';
import { useDraft, useSettings, type SettingValues } from './use-setting.ts';

const KEYS = [
  'system.backups.schedule',
  'system.backups.retention',
  'system.backups.s3',
  'system.backups.encryption',
  'system.backups.verification',
] as const;
type Key = (typeof KEYS)[number];

export interface BackupPolicy {
  schedule: BackupScheduleSettings;
  retention: BackupRetentionSettings;
  encryption: BackupEncryptionSettings;
  verification: BackupVerificationSettings;
}

/** The schemas' own defaults: daily at 02:00 UTC, 24 · 7 · 4 · 3, local unencrypted, weekly drill. */
export const DEFAULT_POLICY: BackupPolicy = {
  schedule: backupScheduleSettingsSchema.parse({}),
  retention: backupRetentionSettingsSchema.parse({}),
  encryption: backupEncryptionSettingsSchema.parse({}),
  verification: backupVerificationSettingsSchema.parse({}),
};

/** The S3 destination form; it always replaces the stored destination as a whole. */
export interface S3Form {
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export const EMPTY_S3: S3Form = {
  endpoint: '',
  region: 'us-east-1',
  bucket: '',
  prefix: 'bemmoly/',
  accessKeyId: '',
  secretAccessKey: '',
  forcePathStyle: false,
};

/** keep: the stored destination stays. replace: the form is written. remove: it is cleared. */
export type S3Edit = { mode: 'keep' } | { mode: 'replace'; form: S3Form } | { mode: 'remove' };

export const toS3Setting = (form: S3Form): BackupS3Settings => ({
  enabled: true,
  ...(form.endpoint.trim() ? { endpoint: form.endpoint.trim() } : {}),
  region: form.region.trim(),
  bucket: form.bucket.trim(),
  prefix: form.prefix.trim(),
  accessKeyId: form.accessKeyId.trim(),
  secretAccessKey: form.secretAccessKey,
  forcePathStyle: form.forcePathStyle,
});

/** What a save writes. The secret S3 value goes only when the admin replaced or removed it. */
export function backupSaveValues(policy: BackupPolicy, s3: S3Edit): SettingValues<Key> {
  return {
    'system.backups.schedule': policy.schedule,
    'system.backups.retention': policy.retention,
    'system.backups.encryption': policy.encryption,
    'system.backups.verification': policy.verification,
    ...(s3.mode === 'replace' ? { 'system.backups.s3': toS3Setting(s3.form) } : {}),
    ...(s3.mode === 'remove' ? { 'system.backups.s3': null } : {}),
  };
}

function errorsOf(prefix: string, schema: z.ZodType, value: unknown): FieldErrors {
  const errors = validateForm(schema, value).errors ?? {};
  return Object.fromEntries(
    Object.entries(errors).map(([path, text]) => [`${prefix}.${path}`, text]),
  );
}

/** Field messages keyed "schedule.time", "retention.daily", "s3.bucket". */
export function policyErrors(policy: BackupPolicy, s3: S3Edit): FieldErrors {
  return {
    ...errorsOf('schedule', backupScheduleSettingsSchema, policy.schedule),
    ...errorsOf('retention', backupRetentionSettingsSchema, policy.retention),
    ...(s3.mode === 'replace' ? errorsOf('s3', backupS3SettingsSchema, toS3Setting(s3.form)) : {}),
  };
}

/** Settings › Storage and backups: schedule, retention, the S3 destination, encryption, drills. */
export function useBackupSchedule() {
  const queryClient = useQueryClient();
  const settings = useSettings(KEYS, 'Backup settings saved');
  const reads = settings.reads;
  const draft = useDraft<BackupPolicy>(
    reads && {
      schedule: reads['system.backups.schedule'].value ?? DEFAULT_POLICY.schedule,
      retention: reads['system.backups.retention'].value ?? DEFAULT_POLICY.retention,
      encryption: reads['system.backups.encryption'].value ?? DEFAULT_POLICY.encryption,
      verification: reads['system.backups.verification'].value ?? DEFAULT_POLICY.verification,
    },
  );
  const [s3, setS3] = useState<S3Edit>({ mode: 'keep' });
  const [errors, setErrors] = useState<FieldErrors>({});

  const discard = () => {
    draft.discard();
    setS3({ mode: 'keep' });
    setErrors({});
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.value) return;
    const found = policyErrors(draft.value, s3);
    setErrors(found);
    if (Object.keys(found).length) return;
    settings.save.mutate(backupSaveValues(draft.value, s3), {
      onSuccess: () => {
        discard();
        // "One disk" and the next run in the status line follow the saved settings.
        void queryClient.invalidateQueries({ queryKey: queryKeys.backups.all() });
      },
    });
  };

  return {
    settings,
    policy: draft.value,
    update: draft.update,
    dirty: draft.dirty || s3.mode !== 'keep',
    /** Whether an S3 destination is stored; the value itself is never read back. */
    s3Configured: reads?.['system.backups.s3'].isSet ?? false,
    s3,
    editS3: (form: S3Form) => setS3({ mode: 'replace', form }),
    startS3: () => setS3({ mode: 'replace', form: EMPTY_S3 }),
    removeS3: () => setS3({ mode: 'remove' }),
    keepS3: () => setS3({ mode: 'keep' }),
    errors,
    submit,
    discard,
  };
}

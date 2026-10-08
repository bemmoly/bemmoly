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
import { useState } from 'react';
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

/** The four sections of Storage and backups, each edited and saved on its own. */
export type BackupSection = 'schedule' | 'retention' | 'destinations' | 'protection';

export interface BackupPolicy {
  schedule: BackupScheduleSettings;
  retention: BackupRetentionSettings;
  encryption: BackupEncryptionSettings;
  verification: BackupVerificationSettings;
}

export type BackupProtection = Pick<BackupPolicy, 'encryption' | 'verification'>;

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

function errorsOf(prefix: string, schema: z.ZodType, value: unknown): FieldErrors {
  const errors = validateForm(schema, value).errors ?? {};
  return Object.fromEntries(
    Object.entries(errors).map(([path, text]) => [`${prefix}.${path}`, text]),
  );
}

export interface BackupDrafts {
  policy: BackupPolicy;
  s3: S3Edit;
}

/**
 * What saving one section writes, or its field messages ("schedule.time", "s3.bucket").
 * Only that section's keys are written; the S3 secret only when it is replaced or removed.
 */
export function sectionWrites(
  section: BackupSection,
  { policy, s3 }: BackupDrafts,
): { values: SettingValues<Key> } | { errors: FieldErrors } {
  const checked = (errors: FieldErrors, values: SettingValues<Key>) =>
    Object.keys(errors).length ? { errors } : { values };
  if (section === 'schedule')
    return checked(errorsOf('schedule', backupScheduleSettingsSchema, policy.schedule), {
      'system.backups.schedule': policy.schedule,
    });
  if (section === 'retention')
    return checked(errorsOf('retention', backupRetentionSettingsSchema, policy.retention), {
      'system.backups.retention': policy.retention,
    });
  if (section === 'protection')
    return {
      values: {
        'system.backups.encryption': policy.encryption,
        'system.backups.verification': policy.verification,
      },
    };
  if (s3.mode === 'remove') return { values: { 'system.backups.s3': null } };
  if (s3.mode === 'keep') return { values: {} };
  const setting = toS3Setting(s3.form);
  return checked(errorsOf('s3', backupS3SettingsSchema, setting), {
    'system.backups.s3': setting,
  });
}

/** Settings › Storage and backups: schedule, retention, the S3 destination, encryption, drills. */
export function useBackupSchedule() {
  const queryClient = useQueryClient();
  const settings = useSettings(KEYS, 'Backup settings saved');
  const reads = settings.reads;
  const stored: BackupPolicy | undefined = reads && {
    schedule: reads['system.backups.schedule'].value ?? DEFAULT_POLICY.schedule,
    retention: reads['system.backups.retention'].value ?? DEFAULT_POLICY.retention,
    encryption: reads['system.backups.encryption'].value ?? DEFAULT_POLICY.encryption,
    verification: reads['system.backups.verification'].value ?? DEFAULT_POLICY.verification,
  };
  const schedule = useDraft(stored?.schedule);
  const retention = useDraft(stored?.retention);
  const protection = useDraft<BackupProtection>(
    stored && { encryption: stored.encryption, verification: stored.verification },
  );
  const [s3, setS3] = useState<S3Edit>({ mode: 'keep' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState<BackupSection | null>(null);

  const policy: BackupPolicy | undefined = stored &&
    schedule.value &&
    retention.value &&
    protection.value && {
      schedule: schedule.value,
      retention: retention.value,
      ...protection.value,
    };

  const discard = (section: BackupSection) => {
    if (section === 'schedule') schedule.discard();
    if (section === 'retention') retention.discard();
    if (section === 'protection') protection.discard();
    if (section === 'destinations') setS3({ mode: 'keep' });
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !key.startsWith(`${prefixOf(section)}.`)),
      ),
    );
  };

  /** Checks a section; returns its writes, or shows its field messages and returns null. */
  const prepare = (section: BackupSection): SettingValues<Key> | null => {
    if (!policy) return null;
    const result = sectionWrites(section, { policy, s3 });
    if ('errors' in result) {
      setErrors((current) => ({ ...current, ...result.errors }));
      return null;
    }
    return result.values;
  };

  const save = (section: BackupSection, values: SettingValues<Key>, onSaved: () => void) => {
    setSaving(section);
    settings.save.mutate(values, {
      onSuccess: () => {
        discard(section);
        onSaved();
        // "One disk" and the next run in the status line follow the saved settings.
        void queryClient.invalidateQueries({ queryKey: queryKeys.backups.all() });
      },
      onSettled: () => setSaving(null),
    });
  };

  return {
    settings,
    stored,
    policy,
    errors,
    saving,
    dirty: {
      schedule: schedule.dirty,
      retention: retention.dirty,
      destinations: s3.mode !== 'keep',
      protection: protection.dirty,
    } satisfies Record<BackupSection, boolean>,
    updateSchedule: (patch: Partial<BackupScheduleSettings>) =>
      schedule.replace({ ...(schedule.value as BackupScheduleSettings), ...patch }),
    updateRetention: (patch: Partial<BackupRetentionSettings>) =>
      retention.replace({ ...(retention.value as BackupRetentionSettings), ...patch }),
    updateProtection: protection.update,
    /** Whether an S3 destination is stored; the value itself is never read back. */
    s3Configured: reads?.['system.backups.s3'].isSet ?? false,
    s3,
    editS3: (form: S3Form) => setS3({ mode: 'replace', form }),
    startS3: () => setS3({ mode: 'replace', form: EMPTY_S3 }),
    removeS3: () => setS3({ mode: 'remove' }),
    keepS3: () => setS3({ mode: 'keep' }),
    discard,
    prepare,
    save,
  };
}

const prefixOf = (section: BackupSection) => (section === 'destinations' ? 's3' : section);

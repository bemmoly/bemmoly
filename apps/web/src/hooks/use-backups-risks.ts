import type { BackupRetentionSettings } from '@bemmoly/shared';
import type { ChangeConfirm } from '../components/settings/use-confirm-change.ts';
import type { BackupProtection, S3Edit } from './use-backups-schedule.ts';

const TIERS: Array<{ key: keyof BackupRetentionSettings; label: string; unit: string }> = [
  { key: 'hourly', label: 'Hourly', unit: 'backups' },
  { key: 'daily', label: 'Daily', unit: 'backups' },
  { key: 'weekly', label: 'Weekly', unit: 'backups' },
  { key: 'monthly', label: 'Monthly', unit: 'backups' },
  { key: 'preUpgradeDays', label: 'Pre-update', unit: 'days' },
];

/** Lowering any tier deletes backups at the next prune, so it asks for the word "confirm". */
export function retentionRisk(
  stored: BackupRetentionSettings,
  next: BackupRetentionSettings,
): ChangeConfirm | null {
  const lowered = TIERS.filter((tier) => next[tier.key] < stored[tier.key]);
  if (lowered.length === 0) return null;
  return {
    title: 'Lower retention?',
    description: 'Fewer backups are kept from the next prune on.',
    consequences: [
      ...lowered.map((tier) =>
        tier.key === 'preUpgradeDays'
          ? `Backups taken before an update are kept ${next.preUpgradeDays} days instead of ${stored.preUpgradeDays}; older ones are deleted.`
          : `${tier.label}: ${stored[tier.key]} → ${next[tier.key]} kept. Up to ${stored[tier.key] - next[tier.key]} older ${tier.label.toLowerCase()} ${tier.unit} are deleted.`,
      ),
      'Deleted backups cannot be restored or downloaded again.',
    ],
    confirmWord: 'confirm',
    confirmLabel: 'Lower retention',
    tone: 'danger',
  };
}

/**
 * Removing the bucket leaves backups on one disk, so the admin types the bucket's name (or
 * "remove" when no backup has said which bucket it is). Replacing it is a plain confirmation.
 */
export function destinationRisk(
  configured: boolean,
  s3: S3Edit,
  bucket: string | null,
): ChangeConfirm | null {
  if (!configured) return null;
  const name = bucket ? `the bucket ${bucket}` : 'the S3 bucket';
  if (s3.mode === 'remove')
    return {
      title: 'Remove the S3 destination?',
      description: 'Backups go back to living only on this machine’s disk.',
      consequences: [
        `New backups stop going to ${name}. If this disk fails, the data and every backup are lost together.`,
        `Copies already in ${name} are not deleted; Bemmoly stops writing to it.`,
        'The stored access keys are deleted. Setting the bucket up again needs them re-entered.',
      ],
      confirmWord: bucket ?? 'remove',
      confirmLabel: 'Remove destination',
      tone: 'danger',
    };
  if (s3.mode === 'replace')
    return {
      title: 'Replace the S3 destination?',
      consequences: [
        `New backups go to ${s3.form.bucket.trim() || 'the new bucket'} instead of ${name}.`,
        `Copies already in ${name} stay there; Bemmoly stops writing to it.`,
      ],
      confirmLabel: 'Replace destination',
      tone: 'caution',
    };
  return null;
}

/** Turning off local encryption leaves new backups readable by anyone with the disk. */
export function protectionRisk(
  stored: BackupProtection,
  next: BackupProtection,
): ChangeConfirm | null {
  if (!(stored.encryption.local && !next.encryption.local)) return null;
  return {
    title: 'Stop encrypting the local copy?',
    consequences: [
      'New backups on this disk are written unencrypted: anyone who can read the disk can read your data.',
      'Backups already taken stay encrypted. Copies sent to a bucket are always encrypted.',
    ],
    confirmLabel: 'Turn off encryption',
    tone: 'caution',
  };
}

/** The bucket named in the newest S3 location ("s3://bucket/<set>"), when a backup has one. */
export function bucketFromLocations(locations: readonly string[]): string | null {
  for (const location of locations) {
    const match = /^s3:\/\/([^/]+)/.exec(location);
    if (match?.[1]) return match[1];
  }
  return null;
}

import type { Backup } from '@bemmoly/shared';
import type { BadgeTone } from '@bemmoly/ui';

export const KIND: Record<Backup['kind'], string> = {
  scheduled: 'Scheduled',
  pre_upgrade: 'Before update',
  manual: 'Manual',
};

export const STATUS: Record<Backup['status'], { label: string; tone: BadgeTone }> = {
  running: { label: 'RUNNING', tone: 'accent' },
  succeeded: { label: 'SUCCEEDED', tone: 'ok' },
  failed: { label: 'FAILED', tone: 'warn' },
  pruned: { label: 'PRUNED', tone: 'neutral' },
};

export const VERIFICATION: Record<
  Backup['verification']['state'],
  { label: string; tone: BadgeTone }
> = {
  restored: { label: 'VERIFIED', tone: 'ok' },
  listed: { label: 'ARCHIVE OK', tone: 'accent' },
  pending: { label: 'PENDING', tone: 'neutral' },
  failed: { label: 'FAILED', tone: 'warn' },
};

export const WHERE: Record<Backup['locations'][number]['destination'], string> = {
  local: 'Local',
  s3: 'S3',
};

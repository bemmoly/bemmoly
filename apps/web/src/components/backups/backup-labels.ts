import type { Backup } from '@bemmoly/shared';
import type { StatusStage } from '@bemmoly/ui';
import type { PillTone } from '../settings/state-pill.tsx';

export const KIND: Record<Backup['kind'], string> = {
  scheduled: 'Scheduled',
  pre_upgrade: 'Before update',
  manual: 'Manual',
};

export const STATUS: Record<
  Backup['status'],
  { label: string; tone: PillTone; stage: StatusStage }
> = {
  running: { label: 'Running', tone: 'acc', stage: 'progress' },
  succeeded: { label: 'Succeeded', tone: 'ok', stage: 'done' },
  failed: { label: 'Failed', tone: 'red', stage: 'wont' },
  pruned: { label: 'Pruned', tone: 'neutral', stage: 'wont' },
};

export const VERIFICATION: Record<
  Backup['verification']['state'],
  { label: string; tone: PillTone }
> = {
  restored: { label: 'Verified', tone: 'ok' },
  listed: { label: 'Archive readable', tone: 'acc' },
  pending: { label: 'Not checked yet', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'red' },
};

export const WHERE: Record<Backup['locations'][number]['destination'], string> = {
  local: 'Local',
  s3: 'S3',
};

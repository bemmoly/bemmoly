import type {
  AuditEntry,
  Backup,
  OutboxSummary,
  SystemStatus,
  UpdateStatus,
} from '@bemmoly/shared';
import { USER_IDS } from './people.ts';
import { seedChecks } from './workspace.ts';
import { ago, ahead, uid } from './time.ts';

const backup = (
  id: string,
  hoursAgo: number,
  kind: Backup['kind'],
  tier: Backup['tier'],
  size: number,
): Backup => ({
  id,
  kind,
  tier,
  status: 'succeeded',
  startedAt: ago(hoursAgo * 60),
  finishedAt: ago(hoursAgo * 60 - 2),
  sizeBytes: size,
  appVersion: '0.1.1',
  destination: '/var/bemmoly/backups',
  verification: hoursAgo > 30 ? 'pending' : 'verified',
  verifiedAt: hoursAgo > 30 ? null : ago(hoursAgo * 60 - 4),
  error: null,
});

export function seedBackups(): Backup[] {
  return [
    backup('bk-0007', 7, 'scheduled', 'daily', 412_000_000),
    backup('bk-0006', 31, 'scheduled', 'daily', 409_000_000),
    { ...backup('bk-0005', 52, 'pre_upgrade', null, 405_000_000), appVersion: '0.1.0' },
    backup('bk-0004', 55, 'scheduled', 'daily', 404_000_000),
    {
      ...backup('bk-0003', 79, 'scheduled', 'daily', 0),
      status: 'failed',
      sizeBytes: null,
      verification: 'not_run',
      error: 'Disk-space guard: 0.6 GB free, needs 0.8 GB (twice the last backup).',
    },
    backup('bk-0002', 24 * 7, 'scheduled', 'weekly', 398_000_000),
  ];
}

export function seedUpdates(): UpdateStatus {
  return {
    currentVersion: '0.1.1',
    channel: 'stable',
    mode: 'in_app',
    command: null,
    lastCheckedAt: ago(42),
    latest: {
      version: '0.1.2',
      publishedAt: ago(60 * 20),
      notes:
        'Fixes the invite email link when BEMMOLY_PUBLIC_URL has a trailing slash.\nBackups: the restore drill now reports row counts per table.\nNo schema changes.',
      irreversible: false,
      slowChangesets: [],
    },
    previous: {
      version: '0.1.0',
      updatedAt: ago(120),
      availableUntil: ahead(60 * 24 * 7 - 120),
      rollbackMode: 'code',
      discardCount: null,
      droppedFields: [],
    },
    job: null,
  };
}

export function seedSystem(lastBackup: Backup | null): SystemStatus {
  return {
    version: '0.1.1',
    health: seedChecks(),
    queue: { queued: 0, active: 1, failed: 0, scheduled: 3 },
    lastBackup,
    aiSpend: null,
  };
}

const AUTH_REJECTED = '535 5.7.8 Authentication rejected: check the SMTP username and password.';

/** The outbox summary in the email stream's shape: "3 emails failed since Tuesday: …". */
export function seedOutbox(): OutboxSummary {
  const failure = (to: string, subject: string, hours: number) => ({
    id: `ob-${hours}`,
    to,
    subject,
    attempts: 5,
    lastError: AUTH_REJECTED,
    failedAt: ago(hours * 60),
  });
  return {
    counts: { queued: 0, sent: 128, failed: 3 },
    failures: { count: 3, since: ago(50 * 60), topReason: AUTH_REJECTED },
    recentFailures: [
      failure('priya@acmelabs.dev', 'Aisha requested your review on PLT-204', 5),
      failure('jonas@acmelabs.dev', 'You were mentioned in Auth service RFC', 26),
      failure('sam@acmelabs.dev', 'Rohan invited you to Acme Labs on Bemmoly', 50),
    ],
  };
}

type AuditRow = [AuditEntry['actorKind'], string | null, string, string, string | null, number];
const AUDIT: AuditRow[] = [
  ['user', USER_IDS.rohan, 'role.capabilities_updated', 'role', 'Contractor', 35],
  ['user', USER_IDS.rohan, 'update.applied', 'system', '0.1.1', 120],
  ['system', null, 'backup.completed', 'backup', 'bk-0007', 60 * 7],
  ['user', USER_IDS.priya, 'team.member_added', 'team', 'Platform', 60 * 30],
  ['user', USER_IDS.rohan, 'user.invited', 'invitation', 'sam@acmelabs.dev', 60 * 50],
  ['system', null, 'backup.completed', 'backup', 'bk-0005', 60 * 52],
  ['user', USER_IDS.rohan, 'setting.updated', 'setting', 'appearance.theme', 60 * 60],
  ['api_token', uid(80), 'module.enabled', 'module', 'sample', 60 * 72],
  ['system', null, 'backup.failed', 'backup', 'bk-0003', 60 * 79],
  ['user', USER_IDS.rohan, 'user.role_changed', 'user', 'Dev P.', 60 * 80],
  ['user', USER_IDS.maya, 'session.created', 'session', null, 60 * 96],
  ['user', USER_IDS.rohan, 'workspace.created', 'workspace', 'Acme Labs', 60 * 24 * 9],
];

export function seedAudit(): AuditEntry[] {
  return AUDIT.map(([actorKind, actorId, action, targetKind, targetId, minutes], index) => ({
    id: uid(200 + index),
    actorId,
    actorKind,
    actorUserId: actorKind === 'api_token' ? USER_IDS.rohan : actorId,
    action,
    targetKind,
    targetId,
    before: null,
    after: null,
    ip: actorKind === 'system' ? null : '10.0.4.21',
    requestId: `req-${index}`,
    aiPlanId: null,
    createdAt: ago(minutes),
  }));
}

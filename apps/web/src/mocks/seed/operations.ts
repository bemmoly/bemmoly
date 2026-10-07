import type {
  AuditEntry,
  Backup,
  OutboxSummary,
  SystemHealthResponse,
  UpdatesOverview,
} from '@bemmoly/shared';
import { USER_IDS } from './people.ts';
import { ago, ahead, uid } from './time.ts';

/** Backup ids are UUIDs on the server; these name the seeded ones. */
export const BACKUP_IDS = {
  latest: uid(307),
  yesterday: uid(306),
  preUpgrade: uid(305),
  older: uid(304),
  failed: uid(303),
  weekly: uid(302),
} as const;

export const LOCAL_BACKUPS = '/var/bemmoly/backups';

const backup = (
  id: string,
  hoursAgo: number,
  kind: Backup['kind'],
  size: number,
  verification: Backup['verification']['state'],
): Backup => ({
  id,
  kind,
  status: 'succeeded',
  createdAt: ago(hoursAgo * 60),
  completedAt: ago(hoursAgo * 60 - 2),
  appVersion: '0.1.1',
  changelogTag: '0.1.1',
  sizeBytes: size,
  attachmentMode: kind === 'scheduled' && hoursAgo < 100 ? 'incremental' : 'full',
  baseBackupId: null,
  encrypted: false,
  locations: [{ destination: 'local', location: `${LOCAL_BACKUPS}/${id}` }],
  verification: {
    state: verification,
    checkedAt: verification === 'pending' ? null : ago(hoursAgo * 60 - 4),
    message: null,
  },
  error: null,
});

export function seedBackups(): Backup[] {
  return [
    backup(BACKUP_IDS.latest, 7, 'scheduled', 412_000_000, 'restored'),
    backup(BACKUP_IDS.yesterday, 31, 'scheduled', 409_000_000, 'listed'),
    {
      ...backup(BACKUP_IDS.preUpgrade, 52, 'pre_upgrade', 405_000_000, 'listed'),
      appVersion: '0.1.0',
      changelogTag: '0.1.0',
    },
    backup(BACKUP_IDS.older, 55, 'scheduled', 404_000_000, 'pending'),
    {
      ...backup(BACKUP_IDS.failed, 79, 'scheduled', 0, 'pending'),
      status: 'failed',
      completedAt: null,
      locations: [],
      error: 'Disk-space guard: 0.6 GB free, needs 0.8 GB (twice the last backup).',
    },
    backup(BACKUP_IDS.weekly, 24 * 7, 'scheduled', 398_000_000, 'restored'),
  ];
}

export function seedUpdates(): UpdatesOverview {
  return {
    current: { version: '0.1.1', channel: 'stable', updatedAt: ago(120), previousVersion: '0.1.0' },
    checks: { enabled: true, lastCheckedAt: ago(42), manifest: 'unverified', error: null },
    available: {
      version: '0.1.2',
      publishedAt: ago(60 * 20),
      notesUrl: 'https://github.com/bemmoly/bemmoly/releases/tag/v0.1.2',
      rollback: 'code',
      slowChangesets: [
        {
          module: 'kernel',
          id: '0014-audit-log-actor-index',
          description: 'Adds an index on the audit log by actor',
          slow: true,
          irreversible: false,
        },
      ],
      irreversibleChangesets: [],
      configChanges: { added: ['BEMMOLY_BACKUP_PARALLELISM'], removed: [] },
    },
    rollback: {
      fromVersion: '0.1.1',
      toVersion: '0.1.0',
      mode: 'code',
      summary: 'Swaps back to the 0.1.0 image. Nothing is lost.',
      reason: 'Every changeset in 0.1.1 is compatible with 0.1.0.',
      schemaChangesets: [],
      discard: null,
      backupId: BACKUP_IDS.preUpgrade,
      expiresAt: ahead(60 * 24 * 7 - 120),
    },
    updater: {
      mode: 'in_app',
      command: 'sudo bemmoly upgrade 0.1.2',
      state: 'idle',
      step: null,
    },
  };
}

/** The Setup mock's first step, with Postgres 18 as the tech design queues. */
export function seedSystem(): SystemHealthResponse {
  return {
    version: '0.1.1',
    role: 'all',
    uptimeSeconds: 3 * 86_400 + 4 * 3_600,
    maintenance: { active: false, reason: null },
    checks: [
      {
        id: 'postgres',
        name: 'Postgres 18',
        status: 'ok',
        value: 'localhost:5432 · 12 ms',
        fix: null,
      },
      { id: 'disk', name: 'Disk', status: 'ok', value: '38 GB free of 80 GB', fix: null },
      { id: 'memory', name: 'Memory', status: 'ok', value: '4 GB · 2 vCPU', fix: null },
      {
        id: 'smtp',
        name: 'Outbound email (SMTP)',
        status: 'warn',
        value: 'not configured',
        fix: {
          label: 'Configure',
          hint: 'Set an SMTP server so invites and password resets reach people.',
          href: '/settings/email',
        },
      },
      { id: 'https', name: 'HTTPS', status: 'ok', value: "Let's Encrypt · auto-renew", fix: null },
      {
        id: 'backups',
        name: 'Backups',
        status: 'ok',
        value: `nightly → ${LOCAL_BACKUPS}`,
        fix: null,
      },
    ],
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
  ['system', null, 'backup.completed', 'backup', BACKUP_IDS.latest, 60 * 7],
  ['user', USER_IDS.priya, 'team.member_added', 'team', 'Platform', 60 * 30],
  ['user', USER_IDS.rohan, 'user.invited', 'invitation', 'sam@acmelabs.dev', 60 * 50],
  ['system', null, 'backup.completed', 'backup', BACKUP_IDS.preUpgrade, 60 * 52],
  ['user', USER_IDS.rohan, 'setting.updated', 'setting', 'appearance.theme', 60 * 60],
  ['api_token', uid(80), 'module.enabled', 'module', 'sample', 60 * 72],
  ['system', null, 'backup.failed', 'backup', BACKUP_IDS.failed, 60 * 79],
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

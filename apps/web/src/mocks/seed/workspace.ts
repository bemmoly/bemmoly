import type {
  AdminModule,
  HealthCheck,
  ModuleManifest,
  Notification,
  NotificationChannel,
  NotificationPreferences,
  SettingKey,
} from '@bemmoly/shared';
import { USER_IDS } from './people.ts';
import { ago } from './time.ts';

/** The Setup mock's first step, with Postgres 18 as the tech design queues. */
export function seedChecks(): HealthCheck[] {
  return [
    { id: 'postgres', name: 'Postgres 18', status: 'ok', detail: 'localhost:5432 · 12 ms' },
    { id: 'disk', name: 'Disk', status: 'ok', detail: '38 GB free of 80 GB' },
    { id: 'memory', name: 'Memory', status: 'ok', detail: '4 GB · 2 vCPU' },
    {
      id: 'smtp',
      name: 'Outbound email (SMTP)',
      status: 'warning',
      detail: 'not configured',
      fix: { label: 'Configure', href: '/settings/email' },
    },
    { id: 'https', name: 'HTTPS', status: 'ok', detail: "Let's Encrypt · auto-renew" },
    { id: 'backups', name: 'Backups', status: 'ok', detail: 'nightly → /var/bemmoly/backups' },
  ];
}

/** Stored settings; secrets keep their value here and read back as `isSet` only. */
export function seedSettings(complete: boolean): Partial<Record<SettingKey, unknown>> {
  return {
    'workspace.name': 'Acme Labs',
    'workspace.url': 'https://bemmoly.acmelabs.internal',
    'workspace.locale': 'en',
    'workspace.timezone': 'UTC',
    'email.provider': 'log',
    'email.smtp.port': 587,
    'email.smtp.security': 'starttls',
    'email.digestMinutes': 10,
    'appearance.theme': 'classic',
    'appearance.font': 'plex',
    'appearance.brandColor': '#2456c9',
    'appearance.logoKey': '',
    'appearance.mode': 'light',
    'appearance.surfaces': 'neutral',
    'appearance.memberModeSwitch': true,
    'appearance.personalThemes': false,
    'ai.providerId': null,
    'ai.shareContent': true,
    'ai.allowActions': true,
    'system.updates.channel': 'stable',
    'system.updates.check': true,
    'system.backups.schedule': { frequency: 'daily', time: '02:00', timezone: 'UTC', weekday: 0 },
    'system.backups.retention': { hourly: 24, daily: 7, weekly: 4, monthly: 3, preUpgradeDays: 7 },
    'system.backups.s3': null,
    'system.backups.encryption': { local: false },
    'system.backups.verification': { testRestore: 'weekly' },
    'setup.completedAt': complete ? ago(60 * 24 * 9) : null,
  };
}

export const SECRET_KEYS: ReadonlySet<SettingKey> = new Set([
  'email.smtp.password',
  'system.backups.s3',
]);

/** A fresh install enables nothing; the seeded workspace had Sample enabled by its admin. */
export function seedAdminModules(enabled = true): AdminModule[] {
  return [
    {
      id: 'sample',
      name: 'Sample',
      version: '0.1.0',
      enabled,
      enabledAt: enabled ? ago(60 * 24 * 9) : null,
      versionInstalled: enabled ? '0.1.0' : null,
      changelogState: enabled ? 'current' : 'pending',
      pendingChangesets: enabled ? 0 : 1,
      dependsOn: [],
      defaultAccess: 'none',
      restartRequired: false,
    },
    {
      id: 'work',
      name: 'Work',
      version: '0.2.0',
      enabled,
      enabledAt: enabled ? ago(60 * 24 * 3) : null,
      versionInstalled: enabled ? '0.2.0' : null,
      changelogState: enabled ? 'current' : 'pending',
      pendingChangesets: enabled ? 0 : 20,
      dependsOn: [],
      defaultAccess: 'teams',
      restartRequired: false,
    },
  ];
}

/** Work is enabled too, so its screens open against the mock work routes. */
export function seedManifests(enabled = true): ModuleManifest[] {
  if (!enabled) return [];
  return [
    {
      id: 'sample',
      version: '0.1.0',
      navigation: [{ id: 'sample', label: 'Sample', path: '/sample', placement: 'top' }],
    },
    {
      id: 'work',
      version: '0.2.0',
      navigation: [
        { id: 'work.board', label: 'Board', path: '/work/board', placement: 'top' },
        { id: 'work.backlog', label: 'Backlog', path: '/work/backlog', placement: 'top' },
      ],
    },
  ];
}

type NoteSeed = [string, keyof typeof USER_IDS, string, string, string, string, number];
const NOTES: NoteSeed[] = [
  [
    'n-1',
    'aisha',
    'Aisha K.',
    'requested your review on',
    'PLT-204',
    'Backfill finished on staging, 0 mismatches across 2.1M rows.',
    180,
  ],
  [
    'n-2',
    'jonas',
    'Jonas M.',
    'commented on',
    'Auth service RFC',
    'Rollback section says 15 min but the flag TTL is 30. Which is it?',
    300,
  ],
  [
    'n-3',
    'priya',
    'Priya N.',
    'mentioned you in',
    'PLT-218',
    '@Rohan can you confirm the deploy hook fires before the health check?',
    60 * 26,
  ],
  ['n-4', 'lena', 'Lena T.', 'moved', 'PLT-226', 'In progress → In review', 60 * 27],
];

/** The Home mock's inbox block, already grouped the way the server groups. */
export function seedNotifications(): Notification[] {
  return NOTES.map(([id, key, name, verb, target, body, minutes]) => ({
    id,
    ids: [id],
    kind: 'mention',
    verb,
    summary: `${name} ${verb} ${target}`,
    actors: [{ id: USER_IDS[key], name }],
    actorCount: 1,
    target: { kind: 'issue', id: target, label: target, url: null },
    body,
    read: false,
    createdAt: ago(minutes),
  }));
}

export function seedPreferences(): NotificationPreferences {
  const kind = (
    name: string,
    channel: NotificationChannel,
    defaultChannel: NotificationChannel = channel,
  ) => ({
    kind: name,
    channel,
    defaultChannel,
  });
  return {
    kinds: [
      kind('mention', 'email_immediate'),
      kind('assignment', 'email_immediate'),
      kind('review_request', 'email_immediate'),
      kind('comment', 'email_digest'),
      kind('status_change', 'inapp'),
      kind('system', 'email_digest'),
    ],
    digest: { cadence: 'interval', dailyHour: 9, timeZone: 'UTC' },
  };
}

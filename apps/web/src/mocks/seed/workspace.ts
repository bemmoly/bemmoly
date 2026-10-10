import type {
  HealthCheck,
  NotificationChannel,
  NotificationPreferences,
  SettingKey,
} from '@bemmoly/shared';
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
    { id: 'backups', name: 'Backups', status: 'ok', detail: 'nightly to /var/bemmoly/backups' },
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
    'appearance.brandColor': '#2356c9',
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

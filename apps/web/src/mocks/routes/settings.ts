import {
  SETTING_SCHEMAS,
  type SettingKey,
  type UpdateNotificationPreferencesRequest,
} from '@bemmoly/shared';
import { audit, can, capabilitiesOf, currentUser, emit, type MockDb } from '../db.ts';
import { SECRET_KEYS } from '../seed/workspace.ts';
import { bodyOf, fail, invalid, notFound, ok, page, type MockRoute } from '../types.ts';
import { capture } from './session.ts';

const isKey = (key: string): key is SettingKey => key in SETTING_SCHEMAS;

const GROUP_CAPABILITIES: Record<string, string> = {
  appearance: 'workspace.appearance.manage',
  email: 'workspace.email.manage',
  system: 'workspace.system.manage',
};

/** As the data kernel: each key needs the capability that owns its group, else settings.manage. */
function allowed(db: MockDb, key: SettingKey): boolean {
  return can(db, GROUP_CAPABILITIES[key.split('.')[0] ?? ''] ?? 'workspace.settings.manage');
}

/** Any workspace.*.manage capability reads the list the settings pages are built from. */
function canRead(db: MockDb): boolean {
  return capabilitiesOf(db, currentUser(db)).some((name) =>
    /^workspace\.[a-z]+\.manage$/.test(name),
  );
}

/** The data kernel's setting body: secrets report `isSet` and never a value. */
function envelope(db: MockDb, key: SettingKey) {
  const stored = db.settings[key];
  const secret = SECRET_KEYS.has(key);
  return {
    key,
    secret,
    isSet: stored !== undefined && stored !== null && stored !== '',
    isDefault: stored === undefined,
    ...(secret || stored === undefined ? {} : { value: stored }),
    updatedAt: null,
  };
}

function emailTest(db: MockDb, to: string) {
  const host = String(db.settings['email.smtp.host'] ?? '');
  const provider = String(db.settings['email.provider'] ?? 'log');
  if (provider === 'smtp' && host.includes('fail')) {
    return {
      sent: false,
      provider,
      to,
      messageId: null,
      failure: {
        stage: 'auth',
        message: `${host} rejected the username and password.`,
        serverResponse: '535 5.7.8 Authentication rejected',
      },
      deliverability: null,
    };
  }
  capture(db, to, 'Bemmoly test email', 'Your email settings work.');
  const from = String(db.settings['email.from'] ?? 'bemmoly@acmelabs.dev');
  const domain = from.split('@')[1] ?? 'acmelabs.dev';
  return {
    sent: true,
    provider,
    to,
    messageId: `<test-${Date.now()}@${domain}>`,
    failure: null,
    deliverability: {
      domain,
      spf: 'pass',
      dmarc: { status: 'missing', record: `_dmarc.${domain} TXT "v=DMARC1; p=none"` },
    },
  };
}

const forbidden = () => fail(403, 'forbidden', 'You need "Manage workspace settings" to do that.');

export const settingsRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/admin/settings',
    handle: (_, db) => {
      if (!canRead(db)) return forbidden();
      const keys = Object.keys(SETTING_SCHEMAS) as SettingKey[];
      return ok({ items: keys.map((key) => envelope(db, key)) });
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/settings/:key',
    handle: (request, db) => {
      const key = request.params['key'] ?? '';
      if (!isKey(key)) return notFound(`Setting ${key}`);
      return canRead(db) ? ok(envelope(db, key)) : forbidden();
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/admin/settings/:key',
    handle: (request, db) => {
      const key = request.params['key'] ?? '';
      if (!isKey(key)) return notFound(`Setting ${key}`);
      if (!allowed(db, key)) return forbidden();
      const parsed = SETTING_SCHEMAS[key].safeParse(bodyOf<{ value: unknown }>(request).value);
      if (!parsed.success)
        return invalid('value', parsed.error.issues[0]?.message ?? 'Invalid value');
      db.settings[key] = parsed.data;
      audit(db, 'setting.updated', 'setting', key);
      emit(db, 'settings.changed', [key]);
      return ok(envelope(db, key));
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/admin/settings/:key',
    handle: (request, db) => {
      const key = request.params['key'] ?? '';
      if (!isKey(key)) return notFound(`Setting ${key}`);
      if (!allowed(db, key)) return forbidden();
      delete db.settings[key];
      emit(db, 'settings.changed', [key]);
      return ok();
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/email/test',
    handle: (request, db) => {
      if (!can(db, 'workspace.email.manage'))
        return fail(403, 'forbidden', 'You cannot send test email.');
      const to =
        bodyOf<{ to?: string }>(request).to ??
        db.users.find((user) => user.id === db.signedInAs)?.email ??
        '';
      return ok(emailTest(db, to));
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/email/outbox',
    handle: (request, db) => {
      if (!can(db, 'workspace.email.manage'))
        return fail(403, 'forbidden', 'You need "Manage email delivery" to see the outbox.');
      const limit = Number(request.query.get('limit') ?? 20) || 20;
      return ok({ ...db.outbox, recentFailures: db.outbox.recentFailures.slice(0, limit) });
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/dev/mailbox',
    handle: (_, db) =>
      db.settings['email.provider'] !== 'log' || !can(db, 'workspace.email.manage')
        ? fail(404, 'not_found', 'The dev mailbox is only available with the log email provider.')
        : ok({ items: db.mailbox }),
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/dev/mailbox',
    handle: (_, db) => {
      db.mailbox = [];
      return ok();
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/email-unsubscriptions',
    anonymous: true,
    handle: (request) =>
      request.query.get('token')
        ? ok({ scope: 'comment', label: 'Comments on things you watch', emailEnabled: true })
        : fail(400, 'bad_request', 'This unsubscribe link is incomplete.'),
  },
  {
    method: 'POST',
    pattern: '/api/v1/email-unsubscriptions',
    anonymous: true,
    handle: () => ({ status: 201, body: {} }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/notifications',
    handle: (request, db) => {
      const unread = request.query.get('unread') === 'true';
      const items = db.notifications.filter((entry) => !unread || !entry.read);
      return ok({
        ...page(items, request),
        unreadCount: db.notifications.filter((entry) => !entry.read).length,
      });
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/notifications/:id',
    handle: (request, db) => {
      const item = db.notifications.find((entry) => entry.id === request.params['id']);
      if (!item) return notFound('That notification');
      item.read = bodyOf<{ read: boolean }>(request).read ?? true;
      emit(db, 'notifications', item.ids);
      return ok({ ids: item.ids, read: item.read });
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/notifications/read-all',
    handle: (_, db) => {
      const unread = db.notifications.filter((entry) => !entry.read);
      for (const item of unread) item.read = true;
      emit(
        db,
        'notifications',
        unread.map((entry) => entry.id),
      );
      return ok({ updated: unread.length });
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/notification-preferences',
    handle: (_, db) => ok(db.preferences),
  },
  {
    method: 'PUT',
    pattern: '/api/v1/notification-preferences',
    handle: (request, db) => {
      const body = bodyOf<UpdateNotificationPreferencesRequest>(request);
      for (const entry of db.preferences.kinds)
        entry.channel = body.kinds?.[entry.kind] ?? entry.channel;
      if (body.digest) db.preferences.digest = body.digest;
      return ok(db.preferences);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/search',
    handle: (request, db) => {
      const q = (request.query.get('q') ?? '').toLowerCase();
      const items = db.users
        .filter((user) => user.name.toLowerCase().includes(q) || user.email.includes(q))
        .slice(0, 8)
        .map((user) => ({
          kind: 'user',
          id: user.id,
          title: user.name,
          subtitle: user.email,
          href: '/settings/users',
        }));
      return ok({ items });
    },
  },
];

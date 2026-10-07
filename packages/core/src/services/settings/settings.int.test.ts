import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createSqlClient, type SqlClient } from '../../clients/postgres.ts';
import type { Actor } from '../../contracts/authz.ts';
import { createIsolatedDatabase, type IsolatedDatabase } from '../../testing/isolated-database.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import { createChangelogRunner, loadKernelChangelog } from '../changelog/index.ts';
import { createRealtimeService, type RealtimeService } from '../realtime/index.ts';
import { createSettingsCatalog } from './catalog.ts';
import { createSecretBox } from './crypto.ts';
import { KERNEL_SETTINGS } from './kernel-settings.ts';
import { createSettingsService } from './service.ts';
import { createSettingsStore } from './store.ts';

const logger = pino({ level: 'silent' });
const admin: Actor = { kind: 'user', id: '0199c0de-0000-7000-8000-000000000002' };
const KEY = Buffer.alloc(32, 5).toString('base64');
const definitions = [
  ...KERNEL_SETTINGS,
  { key: 'email.smtp.password', schema: z.string(), default: '', secret: true },
];

describe('settings against a real database', () => {
  let server: TestDatabase;
  let database: IsolatedDatabase | undefined;
  let sql: SqlClient | undefined;
  const realtimes: RealtimeService[] = [];

  beforeAll(async () => {
    server = await startTestDatabase();
    if (!server.available) return;
    database = await createIsolatedDatabase(server.url);
    sql = createSqlClient(database.url, { maxConnections: 6 });
    const runner = createChangelogRunner({
      sql,
      kernel: await loadKernelChangelog(),
      appVersion: '1',
    });
    await runner.update({ contexts: ['test'] });
  });

  afterAll(async () => {
    for (const realtime of realtimes) await realtime.stop();
    await sql?.end({ timeout: 5 });
    await database?.drop();
    if (server.available) await server.stop();
  });

  function instance(client: SqlClient) {
    const realtime = createRealtimeService({ sql: client, logger });
    realtimes.push(realtime);
    const settings = createSettingsService({
      store: createSettingsStore(client),
      catalog: createSettingsCatalog(undefined, definitions),
      secrets: createSecretBox(KEY),
      realtime: realtime.publisher,
      logger,
    });
    realtime.listener.onMessage((message) => settings.handleRealtime(message));
    return { settings, realtime };
  }

  it('encrypts secrets at rest and decrypts them for the kernel only', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no client' : server.reason);
    const { settings } = instance(sql);
    await settings.write('email.smtp.password', 'p@ss-word', admin);
    const [row] = await sql<{ value: unknown; encrypted: string; is_secret: boolean }[]>`
      select value, encrypted, is_secret from settings where key = 'email.smtp.password'`;
    expect(row).toMatchObject({ value: null, is_secret: true });
    expect(row?.encrypted).toMatch(/^v1\./);
    expect(row?.encrypted).not.toContain('p@ss-word');
    expect(await settings.read('email.smtp.password')).toBe('p@ss-word');
    expect(await settings.view('email.smtp.password')).not.toHaveProperty('value');
  });

  it('audits every change with before and after, and never a secret', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no client' : server.reason);
    const { settings } = instance(sql);
    const editor: Actor = { kind: 'user', id: '0199c0de-0000-7000-8000-000000000003' };
    const meta = { ip: '198.51.100.7', requestId: 'req-settings' };
    const audited = () =>
      sql!<{ action: string; target_id: string; before: unknown; after: unknown }[]>`
        select action, target_id, before, after from audit_log
        where target_kind = 'setting' and actor_id = ${editor.id} order by id`;

    await settings.write('workspace.name', 'Northwind', editor, meta);
    await settings.write('workspace.name', 'Northwind', editor, meta);
    await settings.write('email.smtp.password', 'hunter2-secret', editor);
    await settings.reset('workspace.name', editor);

    const rows = await audited();
    expect(rows).toEqual([
      {
        action: 'setting.updated',
        target_id: 'workspace.name',
        before: { value: 'Bemmoly', isDefault: true },
        after: { value: 'Northwind', isDefault: false },
      },
      {
        action: 'setting.updated',
        target_id: 'email.smtp.password',
        before: { isSet: true },
        after: { isSet: true },
      },
      {
        action: 'setting.reset',
        target_id: 'workspace.name',
        before: { value: 'Northwind', isDefault: false },
        after: { value: 'Bemmoly', isDefault: true },
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain('hunter2');
    const [first] = await sql<{ ip: string; request_id: string }[]>`
      select ip, request_id from audit_log where target_id = 'workspace.name' and actor_id = ${editor.id} order by id limit 1`;
    expect(first).toEqual({ ip: meta.ip, request_id: meta.requestId });
  });

  it('invalidates another process’s cache through NOTIFY', async (ctx) => {
    if (!sql || !database) return ctx.skip(server.available ? 'no client' : server.reason);
    const other = createSqlClient(database.url, { maxConnections: 3 });
    try {
      const a = instance(sql);
      const b = instance(other);
      await a.realtime.start();
      await b.realtime.start();
      expect(await b.settings.get('workspace.name')).toBe('Bemmoly');
      await a.settings.set('workspace.name', 'Acme Labs', admin);
      await expect
        .poll(() => b.settings.get('workspace.name'), { timeout: 5_000 })
        .toBe('Acme Labs');
    } finally {
      for (const realtime of realtimes.splice(0)) await realtime.stop();
      await other.end({ timeout: 5 });
    }
  });
});

import { sql as ddl } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createSqlClient, type SqlClient } from '../../clients/postgres.ts';
import type { Actor } from '../../contracts/authz.ts';
import type { BemmolyModule } from '../../modules/contract.ts';
import { loadModules } from '../../modules/loader.ts';
import { createIsolatedDatabase, type IsolatedDatabase } from '../../testing/isolated-database.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import { createQueryCounter, expectMaxQueries } from '../../testing/query-count.ts';
import {
  createChangelogRunner,
  loadKernelChangelog,
  sourcesFromRegistry,
} from '../changelog/index.ts';
import {
  createSecretBox,
  createSettingsCatalog,
  createSettingsService,
  createSettingsStore,
  KERNEL_SETTINGS,
} from '../settings/index.ts';
import { createModuleAdmin } from './admin.ts';
import { listModuleManifests } from './list.ts';
import { createModuleState } from './state.ts';
import { createModuleStateStore } from './store.ts';

const logger = pino({ level: 'silent' });
const admin: Actor = { kind: 'user', id: '0199c0de-0000-7000-8000-000000000004' };

const widgets: BemmolyModule = {
  id: 'widgets',
  version: '1.0.0',
  coreApi: '^0.1.0',
  defaultAccess: 'everyone',
  changelog: [
    {
      id: '0001-widgets',
      author: 'test',
      description: 'widgets table',
      up: async (ctx) => ctx.exec(ddl`create table widgets (id uuid primary key default uuidv7())`),
      down: async (ctx) => ctx.exec(ddl`drop table widgets`),
    },
  ],
  register: (ctx) =>
    ctx.navigation.add({ id: 'widgets', label: 'Widgets', path: '/widgets', placement: 'top' }),
};

describe('module enable, disable and remove data against a real database', () => {
  let server: TestDatabase;
  let database: IsolatedDatabase | undefined;
  let sql: SqlClient | undefined;
  const counter = createQueryCounter();

  beforeAll(async () => {
    server = await startTestDatabase();
    if (!server.available) return;
    database = await createIsolatedDatabase(server.url);
    sql = createSqlClient(database.url, { maxConnections: 4, onQuery: counter.record });
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
    await database?.drop();
    if (server.available) await server.stop();
  });

  async function boot(client: SqlClient) {
    const registry = loadModules({ available: [widgets] });
    const runner = createChangelogRunner({
      sql: client,
      kernel: await loadKernelChangelog(),
      modules: sourcesFromRegistry(registry),
      appVersion: '1',
    });
    await runner.update({ contexts: ['test'], modules: [] });
    const store = createModuleStateStore(client);
    const state = createModuleState({
      registry,
      store,
      runner,
      contexts: ['test'],
      pinned: [],
      logger,
    });
    await state.initialize({ migrate: true });
    const backups: string[] = [];
    const moduleAdmin = createModuleAdmin({
      registry,
      state,
      store,
      runner,
      contexts: ['test'],
      authorize: async () => undefined,
      backup: {
        backupBeforeRemoval: async ({ moduleId }) => (backups.push(moduleId), { backupId: 'b1' }),
      },
    });
    return { registry, state, moduleAdmin, backups };
  }

  const exists = async (table: string) =>
    (await sql!<{ present: boolean }[]>`select to_regclass(${table}) is not null as present`)[0]
      ?.present;

  it('starts off on a fresh install, keeps data when disabled, removes it only when asked', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    const { state, moduleAdmin, backups, registry } = await boot(sql);
    expect(state.enabledIds()).toEqual([]);
    expect(await exists('widgets')).toBe(false);
    await moduleAdmin.enable(admin, 'widgets', { mode: 'none' });
    expect(state.enabledIds()).toEqual(['widgets']);
    expect(await exists('widgets')).toBe(true);

    await moduleAdmin.disable(admin, 'widgets');
    expect(await exists('widgets')).toBe(true);
    expect(await listModuleManifests(registry, { enabled: state.enabledIds() })).toEqual([]);

    const restarted = await boot(sql);
    expect(restarted.state.isEnabled('widgets')).toBe(false);

    await restarted.moduleAdmin.removeData(admin, 'widgets', 'widgets');
    expect(backups).toEqual([]);
    expect(restarted.backups).toEqual(['widgets']);
    expect(await exists('widgets')).toBe(false);
    const [row] = await sql<
      { changelog_state: string }[]
    >`select changelog_state from modules where id = 'widgets'`;
    expect(row?.changelog_state).toBe('removed');

    const back = await restarted.moduleAdmin.enable(
      admin,
      'widgets',
      { mode: 'none' },
      { ip: '192.0.2.4', requestId: 'req-modules' },
    );
    expect(back).toMatchObject({ enabled: true, changelogState: 'current', pendingChangesets: 0 });
    expect(await exists('widgets')).toBe(true);

    const audited = await sql<
      {
        action: string;
        target_id: string;
        before: Record<string, unknown>;
        after: Record<string, unknown>;
        request_id: string | null;
      }[]
    >`select action, target_id, before, after, request_id from audit_log
      where target_kind = 'module' and actor_id = ${admin.id} order by id`;
    expect(audited.map((row) => row.action)).toEqual([
      'module.enabled',
      'module.disabled',
      'module.data_removed',
      'module.enabled',
    ]);
    const [, disabled, removed, enabled] = audited;
    expect(disabled).toMatchObject({
      target_id: 'widgets',
      before: { enabled: true },
      after: { enabled: false },
    });
    expect(removed?.after).toMatchObject({
      changelogState: 'removed',
      versionInstalled: null,
      changesetsReversed: ['0001-widgets'],
    });
    expect(enabled).toMatchObject({
      before: { enabled: false, changelogState: 'removed' },
      after: {
        enabled: true,
        changelogState: 'current',
        versionInstalled: '1.0.0',
        access: { mode: 'none', teamIds: [] },
      },
      request_id: 'req-modules',
    });
  });

  it('lists modules and settings within a fixed query budget', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    const { moduleAdmin } = await boot(sql);
    const settings = createSettingsService({
      store: createSettingsStore(sql),
      catalog: createSettingsCatalog(undefined, [
        ...KERNEL_SETTINGS,
        { key: 'x.y', schema: z.string(), default: '' },
      ]),
      secrets: createSecretBox(Buffer.alloc(32, 1).toString('base64')),
      logger,
    });
    const listed = await expectMaxQueries(counter, 3, () => moduleAdmin.list(admin));
    expect(listed.items).toHaveLength(1);
    const views = await expectMaxQueries(counter, 1, () => settings.viewAll());
    expect(views.length).toBe(KERNEL_SETTINGS.length + 1);
  });
});

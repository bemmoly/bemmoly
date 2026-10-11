import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness, type SignedInApp } from './boot-harness.ts';
import { importAvailableModules } from './config/modules.ts';
import { modulesWithFixture } from './test-support.ts';

/** Every JSON line a booted process writes, kept so a test can read the levels. */
function captureLogs() {
  const lines: { level: number; msg?: string }[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      for (const line of chunk.toString().split('\n').filter(Boolean)) lines.push(JSON.parse(line));
      done();
    },
  });
  return { stream, lines };
}

const ids = (items: { id: string }[]) => items.map((item) => item.id);

/*
 * An install that enabled a module, gave it access, settings, data and a role override, then
 * updated to an image that no longer ships it: the host boots quietly, the module is gone from
 * every list, and nothing it stored is dropped.
 */
describe('a module a later image no longer ships', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startBootHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });

  afterAll(async () => harness?.stop());

  async function useFixture(app: SignedInApp): Promise<void> {
    const enabled = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/modules/fixture/enable',
      payload: { access: { mode: 'everyone' } },
    });
    expect(enabled.json()).toMatchObject({ id: 'fixture', enabled: true });
    await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/settings/fixture.greeting',
      payload: { value: 'Kept' },
    });
    const item = await app.inject({
      method: 'POST',
      url: '/api/v1/fixture/items',
      payload: { label: 'kept' },
    });
    expect(item.statusCode).toBe(201);
    const roles = (await app.inject({ url: '/api/v1/roles' })).json().items as {
      id: string;
      key: string;
    }[];
    const member = roles.find((role) => role.key === 'member');
    const put = await app.inject({
      method: 'PUT',
      url: `/api/v1/roles/${member?.id}/capabilities`,
      payload: { items: [{ capability: 'fixture.view', allowed: false, lockedByOrg: false }] },
    });
    expect(put.statusCode).toBe(200);
  }

  it('boots without it, quietly, and keeps what it stored', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    await useFixture(await harness.boot('', {}, { available: await modulesWithFixture() }));

    const logs = captureLogs();
    const app = await harness.boot(
      '',
      { LOG_LEVEL: 'info' },
      { available: await importAvailableModules(), logs: logs.stream },
    );
    expect(logs.lines.some((line) => line.msg === 'modules ready')).toBe(true);
    expect(logs.lines.filter((line) => line.level >= 40)).toEqual([]);

    expect((await app.inject({ url: '/api/v1/modules' })).json()).toEqual({ items: [] });
    const me = await app.inject({ url: '/api/v1/me' });
    expect(me.json()).toMatchObject({ modules: [] });
    expect(ids((await app.inject({ url: '/api/v1/admin/modules' })).json().items)).toEqual([
      'docs',
      'work',
    ]);
    expect((await app.inject({ url: '/api/v1/module-grants' })).json()).toEqual({ items: [] });
    const matrix = await app.inject({ url: '/api/v1/capabilities' });
    expect(matrix.statusCode).toBe(200);
    expect(JSON.stringify(matrix.json())).not.toContain('fixture');
    const settings = await app.inject({ url: '/api/v1/admin/settings' });
    expect(settings.statusCode).toBe(200);
    expect(JSON.stringify(settings.json())).not.toContain('fixture.greeting');
    expect((await app.inject({ url: '/api/v1/fixture/items' })).statusCode).toBe(404);
    const enable = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/modules/fixture/enable',
    });
    expect(enable.statusCode).toBe(404);

    const sql = app.instance.database?.sql;
    if (!sql) throw new Error('no database');
    expect(await sql`select label from fixture_items`).toEqual([{ label: 'kept' }]);
    expect(await sql`select enabled from modules where id = 'fixture'`).toEqual([
      { enabled: true },
    ]);
    expect(logs.lines.filter((line) => line.level >= 40)).toEqual([]);
  });

  it('comes back as it was when an image ships it again', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.boot('', {}, { available: await modulesWithFixture() });
    expect(ids((await app.inject({ url: '/api/v1/modules' })).json().items)).toEqual(['fixture']);
    expect((await app.inject({ url: '/api/v1/fixture/greeting' })).json()).toEqual({
      greeting: 'Kept',
    });
    const items = (await app.inject({ url: '/api/v1/fixture/items' })).json().items;
    expect(items.map((item: { label: string }) => item.label)).toEqual(['kept']);
  });
});

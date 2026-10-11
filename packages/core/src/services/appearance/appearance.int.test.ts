import { ConflictError, ForbiddenError, NotFoundError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../../clients/drizzle.ts';
import { createSqlClient, type SqlClient } from '../../clients/postgres.ts';
import { createIsolatedDatabase, type IsolatedDatabase } from '../../testing/isolated-database.ts';
import { kernelChangelogRunner } from '../../testing/kernel-changelog.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import type { RequestContext } from '../authz/index.ts';
import {
  createCustomTheme,
  deleteCustomTheme,
  listCustomThemes,
  setAppearancePreference,
  updateCustomTheme,
  type AppearanceDeps,
} from './index.ts';

describe('themes and modes against a real database', () => {
  let server: TestDatabase;
  let database: IsolatedDatabase | undefined;
  let sql: SqlClient;
  let deps: AppearanceDeps;
  const people: Record<string, string> = {};
  const stored = new Map<string, unknown>();

  const setting = async (key: string) =>
    (await sql<{ value: unknown }[]>`select value from settings where key = ${key}`)[0]?.value;

  const ctx = (name: string, admin = false): RequestContext =>
    ({
      actor: { kind: 'user', id: people[name] },
      authz: {
        authorize: async () => {
          if (!admin) throw new ForbiddenError();
        },
      },
    }) as unknown as RequestContext;

  beforeAll(async () => {
    server = await startTestDatabase();
    if (!server.available) return;
    database = await createIsolatedDatabase(server.url);
    sql = createSqlClient(database.url, { maxConnections: 4 });
    const runner = await kernelChangelogRunner(sql);
    await runner.update({ contexts: ['test'] });
    // Back to the previous minor's schema, with a workspace on the retired Warm preset.
    await runner.rollback('core', { count: 1 });
    for (const name of ['ada', 'bo']) {
      const [row] = await sql<{ id: string }[]>`
        insert into users (email, name, role_id)
        select ${`${name}@example.test`}, ${name}, id from roles where key = 'member'
        returning id`;
      people[name] = row!.id;
    }
    await sql`insert into settings (key, value) values ('appearance.theme', '"warm"')`;
    await runner.update({ contexts: ['test'] });
    deps = {
      db: createDatabase(sql),
      settings: {
        get: async (key: string) => stored.get(key) ?? null,
        set: async (key: string, value: unknown) => void stored.set(key, value),
      } as unknown as AppearanceDeps['settings'],
    };
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
    await database?.drop();
    if (server.available) await server.stop();
  });

  it('moves a retired preset to its theme, keeping its mode and typeface', async () => {
    if (!server.available) return;
    expect(await setting('appearance.theme')).toBe('sand');
    expect(await setting('appearance.defaultMode')).toBe('light');
    expect(await setting('appearance.font')).toBe('source');
  });

  it('turns a stored custom brand into a workspace custom theme, and rolls back', async () => {
    if (!server.available) return;
    const runner = await kernelChangelogRunner(sql);
    await runner.rollback('core', { count: 1 });
    expect(await setting('appearance.theme')).toBe('warm');
    await sql`delete from settings where key in ('appearance.theme', 'appearance.font')`;
    await sql`insert into settings (key, value) values
      ('appearance.theme', '"custom"'), ('appearance.brandColor', '"#0F766E"'),
      ('appearance.mode', '"dark"')`;
    await runner.update({ contexts: ['test'] });
    const id = await setting('appearance.customThemeId');
    const [theme] =
      await sql`select name, brand_color from custom_themes where id = ${id as string}`;
    expect(theme).toMatchObject({ name: 'Custom', brand_color: '#0f766e' });
    expect(await setting('appearance.theme')).toBe('custom');
    expect(await setting('appearance.defaultMode')).toBe('dark');
  });

  it('lets an admin make workspace themes and a person their own only when allowed', async () => {
    if (!server.available) return;
    const input = { name: 'Acme', brandColor: '#0F766E', surface: 'neutral' } as const;
    await expect(
      createCustomTheme(deps, ctx('bo'), { ...input, scope: 'workspace' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const shared = await createCustomTheme(deps, ctx('ada', true), {
      ...input,
      scope: 'workspace',
    });
    expect(shared).toMatchObject({ scope: 'workspace', brandColor: '#0f766e' });

    await expect(
      createCustomTheme(deps, ctx('bo'), { ...input, scope: 'personal' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    stored.set('appearance.personalThemes', true);
    const own = await createCustomTheme(deps, ctx('bo'), {
      name: 'Mine',
      brandColor: '#e11d48',
      surface: 'warm',
      scope: 'personal',
    });
    const visible = (name: string) =>
      listCustomThemes(deps, ctx(name)).then((items) => items.map((t) => t.name));
    expect(await visible('bo')).toEqual(expect.arrayContaining(['Acme', 'Mine']));
    expect(await visible('ada')).not.toContain('Mine');
    await expect(
      updateCustomTheme(deps, ctx('ada', true), own.id, { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect((await updateCustomTheme(deps, ctx('bo'), own.id, { name: 'Rose' })).name).toBe('Rose');

    stored.set('appearance.theme', 'custom');
    stored.set('appearance.customThemeId', shared.id);
    await expect(deleteCustomTheme(deps, ctx('ada', true), shared.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
    await deleteCustomTheme(deps, ctx('bo'), own.id);
    expect(await visible('bo')).not.toContain('Rose');
  });

  it('stores each person mode and, when allowed, their theme', async () => {
    if (!server.available) return;
    stored.set('appearance.personalThemes', false);
    expect(await setAppearancePreference(deps, ctx('ada'), { mode: 'system' })).toEqual({
      mode: 'system',
      theme: null,
    });
    await expect(
      setAppearancePreference(deps, ctx('ada'), { theme: 'pine' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    stored.set('appearance.personalThemes', true);
    expect(await setAppearancePreference(deps, ctx('ada'), { theme: 'pine' })).toEqual({
      mode: 'system',
      theme: 'pine',
    });
    const [row] = await sql`select mode, theme from user_appearance_preferences
      where user_id = ${people['ada']!}`;
    expect(row).toEqual({ mode: 'system', theme: 'pine' });
  });
});

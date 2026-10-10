import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness, type SignedInApp } from './boot-harness.ts';

type Grant = { subjectKind: string; subjectId: string | null };

describe('enabling a module grants only the access the admin chose', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startBootHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });

  afterAll(async () => harness?.stop());

  const enable = (app: SignedInApp, payload?: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/admin/modules/sample/enable',
      ...(payload ? { payload } : {}),
    });
  const disable = (app: SignedInApp) =>
    app.inject({ method: 'POST', url: '/api/v1/admin/modules/sample/disable' });
  const grants = async (app: SignedInApp): Promise<Grant[]> =>
    (await app.inject({ url: '/api/v1/module-grants?moduleId=sample' }))
      .json()
      .items.map(({ subjectKind, subjectId }: Grant) => ({ subjectKind, subjectId }));
  const audited = async (app: SignedInApp) => {
    const sql = app.instance.database?.sql;
    if (!sql) throw new Error('no database');
    return sql<{ action: string; after: Record<string, unknown> }[]>`
      select action, after from audit_log
      where action in ('module.enabled', 'module_grant.created') order by id`;
  };

  it('grants nobody without a choice, then everyone or chosen teams as asked', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.boot();
    const team = (
      await app.inject({ method: 'POST', url: '/api/v1/teams', payload: { name: 'Platform' } })
    ).json() as { id: string };

    const bare = await enable(app);
    expect(bare.statusCode).toBe(200);
    expect(bare.json()).toMatchObject({ id: 'sample', enabled: true });
    expect(await grants(app)).toEqual([]);

    await disable(app);
    const unknownTeam = await enable(app, {
      access: { mode: 'teams', teamIds: ['0199c0de-0000-7000-8000-00000000dead'] },
    });
    expect(unknownTeam.statusCode).toBe(400);
    const noTeams = await enable(app, { access: { mode: 'teams', teamIds: [] } });
    expect(noTeams.statusCode).toBe(400);
    const modules = (await app.inject({ url: '/api/v1/admin/modules' })).json();
    const sample = modules.items.find((item: { id: string }) => item.id === 'sample');
    expect(sample).toMatchObject({ id: 'sample', enabled: false });

    expect((await enable(app, { access: { mode: 'teams', teamIds: [team.id] } })).statusCode).toBe(
      200,
    );
    expect(await grants(app)).toEqual([{ subjectKind: 'team', subjectId: team.id }]);

    await disable(app);
    expect((await enable(app, { access: { mode: 'everyone' } })).statusCode).toBe(200);
    expect(await grants(app)).toEqual([
      { subjectKind: 'team', subjectId: team.id },
      { subjectKind: 'everyone', subjectId: null },
    ]);

    const rows = await audited(app);
    expect(rows.filter((row) => row.action === 'module.enabled').map((row) => row.after)).toEqual([
      expect.objectContaining({ access: { mode: 'none', teamIds: [] } }),
      expect.objectContaining({ access: { mode: 'teams', teamIds: [team.id] } }),
      expect.objectContaining({ access: { mode: 'everyone', teamIds: [] } }),
    ]);
    expect(
      rows.filter((row) => row.action === 'module_grant.created').map((row) => row.after),
    ).toEqual([
      { moduleId: 'sample', subjectKind: 'team', subjectId: team.id, reason: 'module_enabled' },
      { moduleId: 'sample', subjectKind: 'everyone', subjectId: null, reason: 'module_enabled' },
    ]);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { addPerson, call, createFirstAdmin, startHarness, type Harness } from './harness.ts';

describe('teams against a real database', () => {
  let harness: Harness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });
  afterAll(async () => harness?.stop());
  beforeEach(async () => harness?.reset());

  it('counts a team’s members on the team itself and in the list', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const { cookie: admin, userId: adminId } = await createFirstAdmin(app);
    const platform = (
      await call(app, 'POST', '/teams', { cookie: admin, body: { name: 'Platform' } })
    ).json() as { id: string; memberCount: number };
    const design = (
      await call(app, 'POST', '/teams', { cookie: admin, body: { name: 'Design' } })
    ).json() as { id: string };
    expect(platform.memberCount).toBe(0);

    await addPerson(harness, admin, {
      email: 'a@acmelabs.dev',
      role: 'member',
      teamId: platform.id,
    });
    await addPerson(harness, admin, {
      email: 'b@acmelabs.dev',
      role: 'member',
      teamId: platform.id,
    });
    const added = await call(app, 'PUT', `/teams/${platform.id}/members/${adminId}`, {
      cookie: admin,
    });
    expect(added.statusCode).toBeLessThan(300);

    const one = await call(app, 'GET', `/teams/${platform.id}`, { cookie: admin });
    expect(one.statusCode).toBe(200);
    expect(one.json()).toMatchObject({ id: platform.id, memberCount: 3 });
    expect((await call(app, 'GET', `/teams/${design.id}`, { cookie: admin })).json()).toMatchObject(
      { memberCount: 0 },
    );

    const list = (await call(app, 'GET', '/teams', { cookie: admin })).json() as {
      items: { id: string; memberCount: number }[];
    };
    expect(Object.fromEntries(list.items.map((team) => [team.id, team.memberCount]))).toEqual({
      [platform.id]: 3,
      [design.id]: 0,
    });

    const renamed = await call(app, 'PATCH', `/teams/${platform.id}`, {
      cookie: admin,
      body: { name: 'Platform team' },
    });
    expect(renamed.json()).toMatchObject({ name: 'Platform team', memberCount: 3 });
  });
});

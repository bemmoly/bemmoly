import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@bemmoly/shared';
import { createLocationSchema } from '@bemmoly/shared/people';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startPeopleHarness, type PeopleHarness } from '../../testing/people-harness.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';

describe('the person record against Postgres', () => {
  let database: TestDatabase;
  let h: PeopleHarness;

  beforeAll(async () => {
    database = await startTestDatabase();
    if (database.available) h = await startPeopleHarness(database);
  });
  afterAll(async () => {
    if (!database.available) return;
    await h.stop();
    await database.stop();
  });
  beforeEach(async (ctx) => {
    if (!database.available) return ctx.skip(database.reason);
    await h.reset();
  });

  const hire = async (name: string, extra: Record<string, unknown> = {}) => {
    const userId = await h.addUser(name);
    return h.records.create(h.admin, { userId, state: 'active', ...extra });
  };

  it('creates a record for a user, joins it, audits it and publishes in the transaction', async () => {
    const userId = await h.addUser('Mei Lin');
    const person = await h.records.create(h.admin, {
      userId,
      state: 'active',
      startDate: '2026-11-02',
      jobTitle: 'Designer',
    });
    expect(person).toMatchObject({
      userId,
      name: 'Mei Lin',
      email: 'mei.lin@acme.test',
      state: 'active',
      startDate: '2026-11-02',
      endDate: null,
      jobTitle: 'Designer',
    });
    expect(h.published.map((e) => e.kind)).toEqual(['person.joined']);
    expect(h.published[0]?.transaction).toBeDefined();
    const audit = await h.sql<{ action: string }[]>`
      select action from audit_log where target_id = ${userId}`;
    expect(audit.map((row) => row.action)).toEqual(['person.created']);
    expect(await h.directory.get(userId)).toEqual(person);
  });

  it('lets only people with workspace.people.manage write', async () => {
    const userId = await h.addUser('Sam Ortiz');
    await expect(h.records.create(h.member, { userId })).rejects.toBeInstanceOf(ForbiddenError);
    await h.records.create(h.admin, { userId });
    await expect(h.records.update(h.member, userId, { level: 'L2' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      h.org.createLocation(h.member, { name: 'Berlin', timezone: 'Europe/Berlin' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('refuses a second record, an unknown user and a state jump', async () => {
    const person = await hire('Ana Cruz');
    await expect(h.records.create(h.admin, { userId: person.userId })).rejects.toBeInstanceOf(
      ConflictError,
    );
    await expect(
      h.records.create(h.admin, { userId: '0199f000-0000-7000-8000-00000000dead' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const offer = await h.records.create(h.admin, { userId: await h.addUser('Ivo Petrov') });
    await expect(
      h.records.update(h.admin, offer.userId, { state: 'leaving' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('walks the manager chain and reports, and refuses a loop', async () => {
    const ceo = await hire('Ceo Chen');
    const vp = await hire('Vp Varga', { managerId: ceo.userId });
    const lead = await hire('Lead Lee', { managerId: vp.userId });
    const dev = await hire('Dev Diaz', { managerId: lead.userId });
    expect((await h.directory.managerChain(dev.userId)).map((p) => p.name)).toEqual([
      'Lead Lee',
      'Vp Varga',
      'Ceo Chen',
    ]);
    expect((await h.directory.reports(vp.userId)).map((p) => p.name)).toEqual(['Lead Lee']);
    expect((await h.directory.reports(vp.userId, { all: true })).map((p) => p.name)).toEqual([
      'Lead Lee',
      'Dev Diaz',
    ]);
    const loop = await h.records
      .update(h.admin, ceo.userId, { managerId: dev.userId })
      .catch((error: unknown) => error);
    expect(loop).toBeInstanceOf(ValidationError);
    expect((loop as ValidationError).details).toMatchObject({ issues: [{ path: 'managerId' }] });
    await expect(
      h.records.update(h.admin, ceo.userId, { managerId: ceo.userId }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('publishes changed, leaving and left as the record moves', async () => {
    const manager = await hire('Mia Manager');
    const person = await hire('Leo Lane');
    h.published.length = 0;
    await h.records.update(h.admin, person.userId, { managerId: manager.userId, level: 'L4' });
    await h.records.update(h.admin, person.userId, { state: 'leaving', endDate: '2026-12-31' });
    await h.records.update(h.admin, person.userId, { state: 'left' });
    expect(h.published.map((e) => [e.kind, e.payload])).toEqual([
      [
        'person.changed',
        {
          userId: person.userId,
          fields: ['managerId', 'level'],
          before: { managerId: null, level: null },
          after: { managerId: manager.userId, level: 'L4' },
        },
      ],
      [
        'person.leaving',
        { userId: person.userId, endDate: '2026-12-31', managerId: manager.userId },
      ],
      ['person.left', { userId: person.userId, endDate: '2026-12-31', previousState: 'leaving' }],
    ]);
  });

  it('rolls the write back when a subscriber fails', async () => {
    const person = await hire('Rae Rollback');
    const stop = h.events.subscribe('person.changed', () => {
      throw new Error('subscriber failed');
    });
    await expect(h.records.update(h.admin, person.userId, { level: 'L9' })).rejects.toThrow(
      'subscriber failed',
    );
    stop();
    expect((await h.directory.get(person.userId))?.level).toBeNull();
  });

  it('keeps locations and cost centres, filters people by them and guards deletes', async () => {
    const berlin = await h.org.createLocation(
      h.admin,
      createLocationSchema.parse({
        name: 'Berlin',
        timezone: 'Europe/Berlin',
        countryCode: 'de',
        holidayCalendar: 'de-be',
      }),
    );
    expect(berlin).toMatchObject({ countryCode: 'DE', holidayCalendar: 'de-be' });
    await expect(
      h.org.createLocation(h.admin, { name: 'berlin', timezone: 'Europe/Berlin' }),
    ).rejects.toBeInstanceOf(ConflictError);
    const rnd = await h.org.createCostCentre(h.admin, {
      code: 'RND-1',
      name: 'Research',
      ownerUserId: h.adminId,
    });
    const [team] = await h.sql<{ id: string }[]>`
      insert into teams (name) values ('Platform') returning id`;
    const a = await hire('Ada Berlin', { locationId: berlin.id, costCentreId: rnd.id });
    await hire('Ben Elsewhere', { teamId: team!.id });
    expect((await h.directory.list({ locationId: berlin.id })).map((p) => p.userId)).toEqual([
      a.userId,
    ]);
    expect((await h.directory.list({ teamId: team!.id })).map((p) => p.name)).toEqual([
      'Ben Elsewhere',
    ]);
    expect(await h.directory.list({ costCentreId: rnd.id, states: ['left'] })).toEqual([]);
    await expect(h.org.removeLocation(h.admin, berlin.id)).rejects.toBeInstanceOf(ConflictError);
    await expect(
      h.records.update(h.admin, a.userId, { locationId: '0199f000-0000-7000-8000-00000000dead' }),
    ).rejects.toBeInstanceOf(ValidationError);
    const renamed = await h.org.updateCostCentre(h.admin, rnd.id, { name: 'R&D' });
    expect(renamed).toMatchObject({ code: 'RND-1', name: 'R&D', ownerUserId: h.adminId });
  });

  it('pages the people list on the user id', async () => {
    for (const name of ['P One', 'P Two', 'P Three']) await hire(name);
    const first = await h.records.list({ limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await h.records.list({ limit: 2, cursor: first.nextCursor! });
    expect(second).toMatchObject({ nextCursor: null });
    expect(second.items).toHaveLength(1);
  });
});

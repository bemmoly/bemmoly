import { ForbiddenError, NotFoundError, ValidationError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPlanning, type Planning } from '../boards/planning-harness.ts';

describe('saved filters against a real database', () => {
  let planning: Planning | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startPlanning();
    if ('planning' in started) planning = started.planning;
    else skipReason = started.reason;
  });
  afterAll(async () => planning?.stop());

  it('shows a filter shared with a team to its members only', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services, sql } = planning;
    const [ana, ben, eve] = [
      await planning.user('Ana'),
      await planning.user('Ben'),
      await planning.user('Eve'),
    ];
    const [team] = await sql<{ id: string }[]>`
      insert into teams (name) values ('Platform') returning id`;
    for (const userId of [ana, ben]) {
      await sql`insert into team_members (team_id, user_id) values (${team!.id}, ${userId})`;
    }
    const projectId = await planning.project('FLT', 'scrum', [[ana, 'member']]);
    const [asAna, asBen, asEve] = [planning.ctx(ana), planning.ctx(ben), planning.ctx(eve)];

    const shared = await services.filters.create(asAna, {
      name: 'Platform bugs',
      query: 'type = bug AND status != Done ORDER BY priority DESC',
      sharedWith: [team!.id],
    });
    const mine = await services.filters.create(asAna, {
      name: 'Mine',
      query: 'assignee = me',
      projectId,
    });
    expect(shared).toMatchObject({ ownerId: ana, sharedWith: [team!.id], projectId: null });

    const names = async (as: typeof asAna, scope: 'all' | 'mine' | 'shared' = 'all') =>
      (await services.filters.list(as, { scope })).map((filter) => filter.name);
    expect(await names(asAna)).toEqual(['Mine', 'Platform bugs']);
    expect(await names(asBen)).toEqual(['Platform bugs']);
    expect(await names(asBen, 'shared')).toEqual(['Platform bugs']);
    expect(await names(asBen, 'mine')).toEqual([]);
    expect(await names(asEve)).toEqual([]);
    await expect(services.filters.get(asEve, shared.id)).rejects.toThrow(NotFoundError);
    await expect(services.filters.get(asBen, mine.id)).rejects.toThrow(NotFoundError);
    expect((await services.filters.get(asBen, shared.id)).name).toBe('Platform bugs');

    await expect(services.filters.update(asBen, shared.id, { name: 'Taken' })).rejects.toThrow(
      ForbiddenError,
    );
    await expect(services.filters.remove(asBen, shared.id)).rejects.toThrow(ForbiddenError);
    await services.filters.update(asAna, shared.id, { sharedWith: [] });
    expect(await names(asBen)).toEqual([]);

    await expect(
      services.filters.create(asAna, { name: 'Broken', query: 'status = = Done' }),
    ).rejects.toThrow(ValidationError);
    await expect(
      services.filters.create(asAna, { name: 'Unknown', query: 'colour = red' }),
    ).rejects.toThrow(ValidationError);
    await expect(
      services.filters.create(asAna, {
        name: 'Ghost team',
        query: 'assignee = me',
        sharedWith: ['01a00000-0000-7000-8000-000000000000'],
      }),
    ).rejects.toThrow(ValidationError);
    await expect(
      services.filters.create(asEve, { name: 'Outsider', query: 'assignee = me', projectId }),
    ).rejects.toThrow(ForbiddenError);

    await services.filters.remove(asAna, mine.id);
    expect(await names(asAna)).toEqual(['Platform bugs']);
  });
});

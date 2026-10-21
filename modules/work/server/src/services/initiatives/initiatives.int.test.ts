import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPlanning, type Planning } from '../boards/planning-harness.ts';
import { createRoadmapService } from '../roadmap/index.ts';

/*
 * Initiatives against a real database: a program over epics in two projects, rolled up for a
 * member of both and for one who sees a single project, with a card in one project blocking a
 * card in the other drawn on the initiative's timeline as a dependency between their epics.
 */

describe('initiatives against a real database', () => {
  let planning: Planning | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startPlanning();
    if ('planning' in started) planning = started.planning;
    else skipReason = started.reason;
  });
  afterAll(async () => planning?.stop());

  it('gathers epics across projects, rolls them up and draws their dependencies', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services, sql } = planning;
    const ana = await planning.user('Ana');
    const quinn = await planning.user('Quinn');
    const vera = await planning.user('Vera', 'viewer');
    const platform = await planning.project('PLA', 'kanban', [[ana, 'member']]);
    const testing = await planning.project('QAT', 'kanban', [
      [ana, 'member'],
      [quinn, 'member'],
    ]);
    const as = planning.ctx(ana);
    const [epicType] = await sql<{ id: string }[]>`
      select id from issue_types where project_id is null and key = 'epic'`;
    const epic = (projectId: string, title: string, startAt: string, target: string) =>
      planning!.issue(as, {
        projectId,
        title,
        typeId: epicType?.id ?? '',
        startAt,
        customFields: { target_date: target },
      });
    const build = await epic(platform, 'Checkout', '2026-10-01', '2026-11-30');
    const verify = await epic(testing, 'Checkout QA', '2026-11-01', '2026-12-15');
    const card = await planning.issue(as, {
      projectId: platform,
      title: 'API',
      parentId: build.id,
      estimate: 3,
    });
    const check = await planning.issue(as, {
      projectId: testing,
      title: 'Test plan',
      parentId: verify.id,
    });
    await planning.setStatus(check.key, 'Done');

    const created = await services.initiatives.create(as, {
      name: 'New checkout',
      targetAt: '2026-12-31',
      epicIds: [build.id],
    });
    expect(created).toMatchObject({
      name: 'New checkout',
      epics: { total: 1, done: 0, hidden: 0 },
      canManage: true,
    });
    const linked = await services.initiatives.linkEpic(as, created.id, { epicId: verify.id });
    expect(linked.progress).toMatchObject({ total: 2, done: 1, points: 3 });
    expect([...linked.projectIds].sort()).toEqual([platform, testing].sort());
    await expect(
      services.initiatives.linkEpic(as, created.id, { epicId: verify.id }),
    ).rejects.toMatchObject({ name: 'ConflictError' });
    await expect(
      services.initiatives.linkEpic(as, created.id, { epicId: card.id }),
    ).rejects.toMatchObject({ name: 'ValidationError' });

    // Someone who sees only QA sees one epic and that one more is hidden.
    const partial = await services.initiatives.get(planning.ctx(quinn), created.id);
    expect(partial.epics).toEqual({ total: 1, done: 0, hidden: 1 });
    await expect(
      services.initiatives.update(planning.ctx(vera), created.id, { name: 'Nope' }),
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
    await expect(
      services.initiatives.update(as, created.id, { startAt: '2027-02-01' }),
    ).rejects.toMatchObject({ name: 'ValidationError' });

    // A QA card blocks a Platform card: on the timeline, Checkout QA blocks Checkout.
    await services.links.create(as, check.key, { targetId: card.id, kind: 'blocks' });
    const roadmap = createRoadmapService(planning.deps(() => new Date('2026-10-05T12:00:00Z')));
    const view = await roadmap.view(as, { initiative: created.id });
    expect(view.items.map((item) => item.id).sort()).toEqual([build.id, verify.id].sort());
    expect(view.dependencies).toEqual([
      expect.objectContaining({
        fromId: verify.id,
        toId: build.id,
        via: 'issue',
        links: 1,
        conflict: true,
      }),
    ]);

    // Quinn manages initiatives but cannot open Platform: its epic answers as not linked.
    await expect(
      services.initiatives.unlinkEpic(planning.ctx(quinn), created.id, build.id),
    ).rejects.toMatchObject({
      name: 'NotFoundError',
      message: 'The epic is not in this initiative',
    });
    await expect(
      services.initiatives.unlinkEpic(planning.ctx(quinn), created.id, card.id),
    ).rejects.toMatchObject({
      name: 'NotFoundError',
      message: 'The epic is not in this initiative',
    });
    expect((await services.initiatives.get(as, created.id)).epics.total).toBe(2);

    await services.initiatives.unlinkEpic(as, created.id, verify.id);
    const archived = await services.initiatives.archive(as, created.id);
    expect(archived.archivedAt).not.toBeNull();
    const live = await services.initiatives.list(as, { limit: 50, archived: false });
    expect(live.items).toEqual([]);
    const gone = await services.initiatives.list(as, { limit: 50, archived: true });
    expect(gone.items).toHaveLength(1);
    await expect(
      services.initiatives.linkEpic(as, created.id, { epicId: verify.id }),
    ).rejects.toMatchObject({ name: 'ConflictError' });
  });
});

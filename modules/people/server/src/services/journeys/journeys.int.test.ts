import { ForbiddenError } from '@bemmoly/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startPeopleHarness, type PeopleHarness } from '../../testing/harness.ts';

describe('onboarding and offboarding journeys against Postgres', () => {
  let h: PeopleHarness;
  let skip: string | null = null;

  beforeAll(async () => {
    const started = await startPeopleHarness(() => new Date('2026-10-22T10:00:00Z'));
    if (!started.available) {
      skip = started.reason;
      return;
    }
    h = started.harness;
    await h.kernel.records.create(h.actor('admin'), { userId: h.ids.manager, state: 'active' });
    await h.services.journeys.templates.create(h.as('admin'), {
      name: 'Everyone',
      kind: 'onboarding',
      tasks: [
        { title: 'Sign the contract', owner: { type: 'person' }, offsetDays: -7 },
        { title: 'Plan the first week', owner: { type: 'manager' }, offsetDays: -3 },
        { title: 'Order a laptop', owner: { type: 'user', userId: h.ids.admin }, offsetDays: -10 },
      ],
    });
    await h.services.journeys.templates.create(h.as('admin'), {
      name: 'Engineers',
      kind: 'onboarding',
      jobTitle: 'engineer',
      tasks: [{ title: 'Pair on a starter issue', owner: { type: 'manager' }, offsetDays: 2 }],
    });
  });
  afterAll(async () => {
    if (!skip) await h.stop();
  });
  beforeEach((ctx) => {
    if (skip) ctx.skip(skip);
  });

  it('starts the most specific template when the kernel says someone joined', async () => {
    await h.kernel.records.create(h.actor('admin'), {
      userId: h.ids.ana,
      state: 'active',
      startDate: '2026-11-02',
      jobTitle: 'Frontend engineer',
      managerId: h.ids.manager,
    });
    expect(await h.drainJobs()).toBe(1);
    const [journey] = await h.services.journeys.list(h.as('admin'), { userId: h.ids.ana });
    expect(journey).toMatchObject({ kind: 'onboarding', templateName: 'Engineers', taskCount: 1 });
    const detail = await h.services.journeys.get(h.as('manager'), journey!.id);
    expect(detail.tasks[0]).toMatchObject({ ownerId: h.ids.manager, dueDate: '2026-11-04' });
  });

  it('fans tasks out to the person, the manager and named owners, once', async () => {
    await h.kernel.records.create(h.actor('admin'), {
      userId: h.ids.ben,
      state: 'active',
      startDate: '2026-11-16',
      jobTitle: 'Designer',
      managerId: h.ids.manager,
    });
    await h.drainJobs();
    expect(
      await h.services.journeys.startForEvent('onboarding', h.ids.ben, '2026-11-16'),
    ).toBeNull();
    const mine = await h.services.journeys.myTasks(h.as('ben'));
    expect(mine.map((task) => [task.title, task.dueDate])).toEqual([
      ['Sign the contract', '2026-11-09'],
    ]);
    const managers = await h.services.journeys.myTasks(h.as('manager'));
    expect(managers.map((task) => task.title)).toContain('Plan the first week');
  });

  it('lets only the owner tick a task, closes the journey when all are done', async () => {
    const [journey] = await h.services.journeys.list(h.as('admin'), { userId: h.ids.ana });
    const detail = await h.services.journeys.get(h.as('admin'), journey!.id);
    const task = detail.tasks[0]!;
    await expect(
      h.services.journeys.updateTask(h.as('ben'), task.id, { done: true }),
    ).rejects.toThrow(ForbiddenError);
    const after = await h.services.journeys.updateTask(h.as('manager'), task.id, { done: true });
    expect(after).toMatchObject({ state: 'done', doneCount: 1 });
    await expect(h.services.journeys.get(h.as('ben'), journey!.id)).rejects.toThrow(ForbiddenError);
  });

  it('starts offboarding when the kernel says someone is leaving', async () => {
    await h.services.journeys.templates.create(h.as('admin'), {
      name: 'Leavers',
      kind: 'offboarding',
      tasks: [{ title: 'Collect the laptop', owner: { type: 'manager' }, offsetDays: 0 }],
    });
    await h.kernel.records.update(h.actor('admin'), h.ids.ben, {
      state: 'leaving',
      endDate: '2026-12-31',
    });
    await h.drainJobs();
    const journeys = await h.services.journeys.list(h.as('admin'), {
      userId: h.ids.ben,
      kind: 'offboarding',
    });
    expect(journeys).toHaveLength(1);
    expect(journeys[0]).toMatchObject({ anchorDate: '2026-12-31', templateName: 'Leavers' });
  });
});

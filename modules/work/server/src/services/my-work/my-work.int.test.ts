import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';

describe('my work against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let project: Project;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    project = await work.project('MINE', [work.users.member]);
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('lists what is assigned to, reported by and watched by the person, without repeats', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const { admin, member } = work.users;
    const assigned = await work.issue(project, 'Assigned to mo', { assigneeId: member });
    const reported = await work.issue(project, 'Reported by mo', {}, member);
    const watched = await work.issue(project, 'Watched by mo');
    await work.services.issues.watch(work.as(member), watched.key, true);
    await work.issue(project, 'Nothing to do with mo');
    const done = await work.issue(project, 'Assigned and done', { assigneeId: member });
    const [doneStatus] = await work.sql<{ id: string }[]>`
      select id from workflow_statuses where name = 'Won''t do'`;
    await work.services.issues.update(work.as(admin), done.key, { statusId: doneStatus?.id ?? '' });

    const mine = await work.services.myWork.list(work.as(member), { limit: 6 });
    expect(mine.assigned.items.map((issue) => issue.key)).toEqual([assigned.key, done.key]);
    expect(mine.assigned.total).toBe(2);
    expect(mine.assigned.items[0]).toMatchObject({
      title: 'Assigned to mo',
      priority: 'medium',
      status: { name: 'Backlog', category: 'todo' },
      type: { key: 'task', name: 'Task' },
    });
    expect(mine.reported.items.map((issue) => issue.key)).toEqual([reported.key]);
    expect(mine.watching.items.map((issue) => issue.key)).toEqual([watched.key]);
  });

  it('caps each list but counts every match, and drops projects the person left', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const { outsider } = work.users;
    const elsewhere = await work.project('LEFT', [outsider]);
    for (let index = 0; index < 4; index += 1) {
      await work.issue(elsewhere, `For otto ${index}`, { assigneeId: outsider });
    }
    const capped = await work.services.myWork.list(work.as(outsider), { limit: 3 });
    expect(capped.assigned.items).toHaveLength(3);
    expect(capped.assigned.total).toBe(4);
    await work.sql`delete from project_members where user_id = ${outsider}`;
    const left = await work.services.myWork.list(work.as(outsider), { limit: 3 });
    expect(left.assigned).toEqual({ items: [], total: 0 });
  });
});

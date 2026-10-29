import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';
import { createWorkStartSource } from './start.ts';

describe("Work's start page summary against Postgres", () => {
  let start: HarnessStart;
  let work: WorkHarness;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('counts open assigned issues and lists the ones due within a week as needing the person', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const { admin, member } = work.users;
    const project = await work.project('STRT', [member]);
    const soon = await work.issue(project, 'Due tomorrow', { assigneeId: member });
    const later = await work.issue(project, 'Due next month', { assigneeId: member });
    const open = await work.issue(project, 'No due date', { assigneeId: member });
    const done = await work.issue(project, 'Finished', { assigneeId: member });
    await work.issue(project, 'Someone else', { assigneeId: admin });
    await work.sql`update issues set due_at = current_date + 1 where id = ${soon.id}`;
    await work.sql`update issues set due_at = current_date + 30 where id = ${later.id}`;
    const [doneStatus] = await work.sql<{ id: string }[]>`
      select id from workflow_statuses where name = 'Won''t do'`;
    await work.services.issues.update(work.as(admin), done.key, { statusId: doneStatus?.id ?? '' });

    const source = createWorkStartSource({ database: work.sql });
    const summary = await source.summaryForUser(work.as(member));
    expect(summary.waiting).toEqual({ count: 3, label: 'issues assigned to you' });
    expect(summary.needsYou?.map((entry) => entry.handle)).toEqual([soon.key]);
    expect(summary.needsYou?.[0]).toMatchObject({
      title: 'Due tomorrow',
      path: `/work/issue/${soon.key}`,
    });
    expect(summary.recent?.map((entry) => entry.handle).sort()).toEqual(
      [soon.key, later.key, open.key].sort(),
    );
  });

  it('answers empty for someone with nothing assigned', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const source = createWorkStartSource({ database: work.sql });
    const summary = await source.summaryForUser(work.as(work.users.outsider));
    expect(summary).toEqual({
      waiting: { count: 0, label: 'issues assigned to you' },
      needsYou: [],
      recent: [],
    });
  });
});

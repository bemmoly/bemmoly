import {
  NOTIFICATION_EVENT_KINDS,
  ValidationError,
  type NotificationRequestedPayload,
} from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';

/*
 * Several assignees against Postgres: the primary stays on assignee_id, the stints follow every
 * write path through the trigger, and replacing the set keeps closed stints as history.
 */

describe('issue assignees against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (start.available) work = start.harness;
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  const stints = (issueId: string) =>
    work.sql<{ user_id: string; open: boolean }[]>`
      select user_id, removed_at is null as open from issue_assignees
      where issue_id = ${issueId} order by added_at, id`;

  it('opens a stint for the primary on create and on a single-assignee update', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const { admin, member } = work.users;
    const project = await work.project('ONE', [member]);
    const issue = await work.issue(project, 'Solo', { assigneeId: admin });
    expect(await stints(issue.id)).toEqual([{ user_id: admin, open: true }]);

    await work.services.issues.assign(work.as(admin), issue.key, member);
    expect(await stints(issue.id)).toEqual([
      { user_id: admin, open: false },
      { user_id: member, open: true },
    ]);
  });

  it('sets several assignees, the first as primary, and keeps removed ones as history', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const { admin, member, outsider } = work.users;
    const as = work.as(admin);
    const project = await work.project('PAIR', [member]);
    const issue = await work.issue(project, 'Pair on it', { assigneeId: admin });

    const pair = await work.services.issues.setAssignees(as, issue.key, {
      assigneeIds: [member, admin],
    });
    expect(pair.map((user) => user.id)).toEqual([member, admin]);
    const detail = await work.services.issues.get(as, issue.key);
    expect(detail.assigneeId).toBe(member);
    expect(detail.assignees.map((user) => user.id)).toEqual([member, admin]);
    expect(detail.assigneeIds).toEqual([member, admin]);
    const backlog = await work.services.backlog.get(as, project.key);
    const row = [...backlog.sprints.flatMap((sprint) => sprint.issues), ...backlog.issues].find(
      (item) => item.key === issue.key,
    );
    expect(row?.assigneeIds).toEqual([member, admin]);

    const mob = await work.services.issues.setAssignees(as, issue.key, {
      assigneeIds: [member, outsider],
    });
    expect(mob.map((user) => user.id)).toEqual([member, outsider]);
    const open = (await stints(issue.id)).filter((row) => row.open).map((row) => row.user_id);
    expect(open.sort()).toEqual([member, outsider].sort());

    const none = await work.services.issues.setAssignees(as, issue.key, { assigneeIds: [] });
    expect(none).toEqual([]);
    expect((await work.services.issues.get(as, issue.key)).assigneeId).toBeNull();
    expect((await stints(issue.id)).every((row) => !row.open)).toBe(true);
  });

  it('refuses an id that is not a user', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const project = await work.project('GHOST');
    const issue = await work.issue(project, 'Nobody');
    await expect(
      work.services.issues.setAssignees(work.as(work.users.admin), issue.key, {
        assigneeIds: ['01900000-0000-7000-8000-000000000000'],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('finds an issue by any of its assignees and by who paired on it', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const { admin, member, outsider } = work.users;
    const as = work.as(admin);
    const project = await work.project('LQL', [member]);
    const paired = await work.issue(project, 'Paired', { assigneeId: admin });
    await work.services.issues.setAssignees(as, paired.key, { assigneeIds: [admin, member] });
    const handed = await work.issue(project, 'Handed over', { assigneeId: outsider });
    await work.services.issues.assign(as, handed.key, member);
    const solo = await work.issue(project, 'Solo', { assigneeId: outsider });

    const [mo] = await work.sql<{ email: string }[]>`select email from users where id = ${member}`;
    const keys = async (q: string) =>
      (
        await work.services.lql.query(as, {
          lql: `${q} ORDER BY created ASC`,
          projectId: project.id,
          limit: 50,
        })
      ).items.map((issue) => issue.key);

    const email = `"${mo?.email}"`;
    expect(await keys(`assignee = ${email}`)).toEqual([paired.key, handed.key]);
    expect(await keys(`assignee != ${email}`)).toEqual([solo.key]);
    expect(await keys(`pairedWith = ${email}`)).toEqual([paired.key]);
    expect(await keys('pairedWith IS NOT EMPTY')).toEqual([paired.key]);
  });

  it('tells each person newly added beside the primary, once', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const { admin, member } = work.users;
    const as = work.as(admin);
    const assignments = () =>
      work.events
        .filter((event) => event.kind === NOTIFICATION_EVENT_KINDS.notificationRequested)
        .map((event) => event.payload as NotificationRequestedPayload)
        .filter((notice) => notice.kind === 'assignment');
    const project = await work.project('TELL', [member]);
    const issue = await work.issue(project, 'Tell them', { assigneeId: admin });
    const before = assignments().length;
    await work.services.issues.setAssignees(as, issue.key, { assigneeIds: [admin, member] });
    await work.services.issues.setAssignees(as, issue.key, { assigneeIds: [admin, member] });
    expect(
      assignments()
        .slice(before)
        .map((notice) => notice.recipientIds),
    ).toEqual([[member]]);
  });
});

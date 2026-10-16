import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPlanning, type Planning } from '../boards/planning-harness.ts';
import { createTimeTrackingService } from './time-tracking-service.ts';

describe('time tracking report against a real database', () => {
  let planning: Planning | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startPlanning();
    if ('planning' in started) planning = started.planning;
    else skipReason = started.reason;
  });
  afterAll(async () => planning?.stop());

  /*
   * A (3 pts, in a sprint started 2 March) and B (unestimated); C is deleted. Ana and Ben log
   * on A and B in the last two weeks, one log is older than the window and one is on C.
   * The clock stops at 18:00 on 12 March.
   */
  it('sums the logs by week, person and issue, for the window or a sprint', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { sql } = planning;
    const service = createTimeTrackingService(
      planning.deps(() => new Date('2026-03-12T18:00:00Z')),
    );
    const ana = await planning.user('Ana');
    const ben = await planning.user('Ben');
    const projectId = await planning.project('TTR', 'scrum', [
      [ana, 'member'],
      [ben, 'member'],
    ]);
    const as = planning.ctx(ana);
    const a = await planning.issue(as, { projectId, title: 'A', estimate: 3 });
    const b = await planning.issue(as, { projectId, title: 'B' });
    const c = await planning.issue(as, { projectId, title: 'C' });
    await sql`update issues set deleted_at = now() where id = ${c.id}`;
    const [sprint] = await sql<{ id: string }[]>`
      insert into sprints (project_id, name, state, started_at)
      values (${projectId}, 'Sprint 1', 'active', '2026-03-02T09:00:00Z') returning id`;
    await sql`update issues set sprint_id = ${sprint!.id} where id = ${a.id}`;

    const logs: [string, string, number, string][] = [
      [a.id, ana, 90, '2026-03-03T10:00:00Z'],
      [a.id, ben, 60, '2026-03-10T10:00:00Z'],
      [b.id, ana, 45, '2026-03-11T10:00:00Z'],
      [a.id, ana, 600, '2026-01-01T10:00:00Z'],
      [c.id, ana, 600, '2026-03-11T10:00:00Z'],
    ];
    for (const [issueId, userId, minutes, at] of logs) {
      await sql`
        insert into work_logs (issue_id, user_id, minutes, started_at)
        values (${issueId}, ${userId}, ${minutes}, ${at}::timestamptz)`;
    }

    const report = await service.report(as, 'TTR', { days: 14 });
    expect(report).toMatchObject({ from: '2026-02-27', to: '2026-03-12', totalMinutes: 195 });
    expect(report.weeks).toEqual([
      { date: '2026-02-27', minutes: 90 },
      { date: '2026-03-06', minutes: 105 },
    ]);
    expect(report.people.map((person) => [person.name, person.minutes])).toEqual([
      ['Ana', 135],
      ['Ben', 60],
    ]);
    expect(report.issues.map((issue) => [issue.key, issue.estimate, issue.minutes])).toEqual([
      [a.key, 3, 150],
      [b.key, null, 45],
    ]);

    const inSprint = await service.report(as, 'TTR', { days: 30, sprintId: sprint!.id });
    expect(inSprint).toMatchObject({ from: '2026-03-02', to: '2026-03-12', totalMinutes: 150 });
    expect(inSprint.issues.map((issue) => issue.key)).toEqual([a.key]);

    await expect(
      service.report(as, 'TTR', { days: 30, sprintId: '018f0000-0000-7000-8000-000000000000' }),
    ).rejects.toThrow(/not found/);
  });
});

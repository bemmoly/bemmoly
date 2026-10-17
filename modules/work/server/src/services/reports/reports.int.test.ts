import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPlanning, type Planning } from '../boards/planning-harness.ts';
import { createReportsService } from './index.ts';

describe('tier-two reports against a real database', () => {
  let planning: Planning | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startPlanning();
    if ('planning' in started) planning = started.planning;
    else skipReason = started.reason;
  });
  afterAll(async () => planning?.stop());

  /*
   * An epic with A (3) and B (5), both created on 1 March in Backlog. A moved to In progress
   * on 9 March and to Done on 11 March; B never moved. A version holds B alone. The clock
   * stops at 18:00 on 12 March.
   */
  it('draws the control chart, time in status and the epic and version burnups', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { sql } = planning;
    const reports = createReportsService(planning.deps(() => new Date('2026-03-12T18:00:00Z')));
    const ana = await planning.user('Ana');
    const projectId = await planning.project('REP', 'scrum', [[ana, 'member']]);
    const as = planning.ctx(ana);
    const [epicType] = await sql<{ id: string }[]>`
      select id from issue_types where level = 'epic' and project_id is null limit 1`;
    // Created as a task, since an epic asks for fields this test has no use for.
    const epic = await planning.issue(as, { projectId, title: 'Checkout' });
    await sql`update issues set type_id = ${epicType!.id} where id = ${epic.id}`;
    const a = await planning.issue(as, { projectId, title: 'A', estimate: 3, parentId: epic.id });
    const b = await planning.issue(as, { projectId, title: 'B', estimate: 5, parentId: epic.id });
    const [version] = await sql<{ id: string }[]>`
      insert into versions (project_id, name) values (${projectId}, '1.0') returning id`;
    await sql`update issues set fix_version_id = ${version!.id} where id = ${b.id}`;
    await sql`update issues set created_at = '2026-03-01T00:00:00Z' where project_id = ${projectId}`;

    const [backlog, doing, done] = [
      await planning.status('Backlog'),
      await planning.status('In progress'),
      await planning.status('Done'),
    ];
    await sql`
      update issues set status_id = ${done}, status_changed_at = '2026-03-11T10:00:00Z',
        resolved_at = '2026-03-11T10:00:00Z'
      where id = ${a.id}`;
    const moves: [unknown, unknown, string][] = [
      [backlog, doing, '2026-03-09T10:00:00Z'],
      [doing, done, '2026-03-11T10:00:00Z'],
    ];
    for (const [from, to, at] of moves) {
      await sql`
        insert into issue_history (issue_id, field, from_value, to_value, created_at)
        values (${a.id}, 'statusId', ${JSON.stringify(from)}::jsonb, ${JSON.stringify(to)}::jsonb,
          ${at}::timestamptz)`;
    }

    const control = await reports.control(as, 'REP', { days: 30 });
    expect(control.points.map((point) => [point.key, point.cycleDays])).toEqual([[a.key, 2]]);
    expect(control).toMatchObject({ from: '2026-02-11', to: '2026-03-12', meanDays: 2 });

    const time = await reports.timeInStatus(as, 'REP', { days: 30 });
    const byName = new Map(time.statuses.map((status) => [status.name, status]));
    expect(byName.get('In progress')).toMatchObject({ averageDays: 2, issues: 1 });
    expect(byName.get('Done')).toMatchObject({ averageDays: 1.3, issues: 1 });
    expect(byName.get('Backlog')?.issues).toBe(3);

    const epicReport = await reports.scope(as, 'REP', { kind: 'epic', weeks: 4 });
    expect(epicReport.target).toMatchObject({ id: epic.id, label: `${epic.key} Checkout` });
    expect(
      epicReport.weeks.map((week) => [week.date, week.scopePoints, week.completedPoints]),
    ).toEqual([
      ['2026-02-19', 0, 0],
      ['2026-02-26', 0, 0],
      ['2026-03-05', 8, 0],
      ['2026-03-12', 8, 3],
    ]);

    const versionReport = await reports.scope(as, 'REP', { kind: 'version', weeks: 4 });
    expect(versionReport.target?.label).toBe('1.0');
    expect(versionReport.weeks.at(-1)).toMatchObject({ scopePoints: 5, scopeIssues: 1 });
  });
});

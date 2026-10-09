import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPlanning, type Planning } from '../boards/planning-harness.ts';
import { createMetricsService } from './index.ts';

describe('sprint metrics against a real database', () => {
  let planning: Planning | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startPlanning();
    if ('planning' in started) planning = started.planning;
    else skipReason = started.reason;
  });
  afterAll(async () => planning?.stop());

  /*
   * A three-day sprint from 10 March: A finishes on day one, B is re-estimated
   * from 5 to 8 and D joins on day two, E lives and dies on day two, C goes
   * back to the backlog early on day three, and F was finished before the
   * sprint began. The clock stops at 18:00 on day three.
   */
  it('draws the burndown from history and velocity from the snapshots', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services, sql } = planning;
    const metrics = createMetricsService(planning.deps(() => new Date('2026-03-12T18:00:00Z')));
    const ana = await planning.user('Ana');
    const projectId = await planning.project('MET', 'scrum', [[ana, 'member']]);
    const as = planning.ctx(ana);
    const sprint = await services.sprints.create(as, projectId, { name: 'Sprint 1' });
    const issue = (title: string, estimate: number, sprintId: string | null = sprint.id) =>
      planning!.issue(as, { projectId, title, estimate, sprintId });
    const [a, b, c, d, e, f] = [
      await issue('A', 3),
      await issue('B', 8),
      await issue('C', 2, null),
      await issue('D', 1),
      await issue('E', 4),
      await issue('F', 2),
    ];
    await services.sprints.start(as, sprint.id, {});
    await planning.setStatus(a!.key, 'Done');
    await planning.setStatus(f!.key, 'Done');
    await sql`update sprints set started_at = '2026-03-10T09:00:00Z' where id = ${sprint.id}`;
    await sql`update issues set created_at = '2026-03-09T12:00:00Z' where project_id = ${projectId}`;
    await sql`
      update issues set created_at = '2026-03-11T08:00:00Z', deleted_at = '2026-03-11T20:00:00Z'
      where id = ${e!.id}`;
    const backlog = await planning.status('Backlog');
    const done = await planning.status('Done');
    const history: [string, string, unknown, unknown, string][] = [
      [a!.id, 'statusId', backlog, done, '2026-03-10T15:00:00Z'],
      [b!.id, 'estimate', 5, 8, '2026-03-11T12:00:00Z'],
      [d!.id, 'sprintId', null, sprint.id, '2026-03-11T10:00:00Z'],
      [c!.id, 'sprintId', sprint.id, null, '2026-03-12T00:30:00Z'],
    ];
    for (const [issueId, field, from, to, at] of history) {
      await sql`
        insert into issue_history (issue_id, field, from_value, to_value, created_at)
        values (${issueId}, ${field}, ${JSON.stringify(from)}::jsonb, ${JSON.stringify(to)}::jsonb,
          ${at}::timestamptz)`;
    }
    await sql`
      insert into sprints (project_id, name, state, started_at, closed_at, completed_snapshot)
      values (${projectId}, 'Sprint 0', 'closed', '2026-02-24T09:00:00Z', '2026-03-09T17:00:00Z',
        ${JSON.stringify({
          committedPoints: 10,
          completedPoints: 8,
          committedIssues: 4,
          completedIssues: 3,
          carriedOverTo: null,
        })}::jsonb)`;

    const report = await metrics.sprintReport(as, sprint.id);
    expect(report.burndown).toEqual([
      { date: '2026-03-10', remainingPoints: 7 },
      { date: '2026-03-11', remainingPoints: 11 },
      { date: '2026-03-12', remainingPoints: 9 },
    ]);
    expect(report.velocity.map((point) => [point.name, point.completedPoints])).toEqual([
      ['Sprint 0', 8],
    ]);

    const [board] = await services.boards.listForProject(as, projectId);
    const first = await metrics.board(as, board!.id, { sprints: 6 });
    expect(first).toMatchObject({
      sprintId: sprint.id,
      burndown: report.burndown,
      velocity: [expect.objectContaining({ committedPoints: 10, completedPoints: 8 })],
      committedPoints: 14,
      completedPoints: 5,
    });
    const computedAt = async () =>
      (
        await sql<{ at: string }[]>`
          select computed_at::text as at from sprint_metrics where scope_id = ${board!.id}`
      )[0]?.at;
    const cachedAt = await computedAt();
    await metrics.board(as, board!.id, { sprints: 6 });
    expect(await computedAt()).toBe(cachedAt);
    await sql`update issues set estimate = 13, updated_at = now() where id = ${b!.id}`;
    expect((await metrics.board(as, board!.id, { sprints: 6 })).committedPoints).toBe(19);
    expect(await computedAt()).not.toBe(cachedAt);
  });
});

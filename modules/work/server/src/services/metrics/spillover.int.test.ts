import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPlanning, type Planning } from '../boards/planning-harness.ts';
import { createMetricsService } from './index.ts';

describe('spillover and added scope against a real database', () => {
  let planning: Planning | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startPlanning();
    if ('planning' in started) planning = started.planning;
    else skipReason = started.reason;
  });
  afterAll(async () => planning?.stop());

  /*
   * Sprint 1 starts with A (3) and B (5); C (2) joins after the start. A is
   * finished and Sprint 1 closes, handing B and C to Sprint 2, which starts
   * with them and takes on D (1) after its start.
   */
  it('reports the work carried over and the scope added after each start', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services } = planning;
    const metrics = createMetricsService(planning.deps());
    const ana = await planning.user('Ana');
    const projectId = await planning.project('SPL', 'scrum', [[ana, 'member']]);
    const as = planning.ctx(ana);
    const first = await services.sprints.create(as, projectId, { name: 'Sprint 1' });
    const second = await services.sprints.create(as, projectId, { name: 'Sprint 2' });
    const issue = (title: string, estimate: number, sprintId: string) =>
      planning!.issue(as, { projectId, title, estimate, sprintId });
    const a = await issue('A', 3, first.id);
    const b = await issue('B', 5, first.id);
    await services.sprints.start(as, first.id, {});
    const c = await issue('C', 2, first.id);
    await planning.setStatus(a!.key, 'Done');
    await services.sprints.complete(as, first.id, { moveUnfinishedTo: second.id });
    await services.sprints.start(as, second.id, {});
    const d = await issue('D', 1, second.id);

    const report = await metrics.sprintReport(as, second.id);
    const ids = (list: { issueId: string }[]) => list.map((row) => row.issueId).sort();
    expect(ids(report.scope.carriedOver)).toEqual([b!.id, c!.id].sort());
    expect(ids(report.scope.added)).toEqual([d!.id]);
    expect(report.changes).toEqual({
      scopeIssues: 3,
      scopePoints: 8,
      carriedOverIssues: 2,
      carriedOverPoints: 7,
      addedIssues: 1,
      addedPoints: 1,
    });
    expect(report.velocity).toEqual([
      expect.objectContaining({
        name: 'Sprint 1',
        committedPoints: 8,
        completedPoints: 3,
        scopeIssues: 3,
        carriedOverIssues: 0,
        addedIssues: 1,
        addedPoints: 2,
      }),
    ]);

    await services.sprints.complete(as, second.id, { moveUnfinishedTo: 'backlog' });
    const after = await metrics.sprintReport(as, second.id);
    expect(after.velocity.map((point) => [point.name, point.carriedOverIssues])).toEqual([
      ['Sprint 1', 0],
      ['Sprint 2', 2],
    ]);
    expect(after.velocity[1]).toMatchObject({ carriedOverPoints: 7, addedIssues: 1 });
  });
});

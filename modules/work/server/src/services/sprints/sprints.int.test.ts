import { ConflictError, ForbiddenError, ValidationError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPlanning, type Planning } from '../boards/planning-harness.ts';

describe('sprints and the backlog against a real database', () => {
  let planning: Planning | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startPlanning();
    if ('planning' in started) planning = started.planning;
    else skipReason = started.reason;
  });
  afterAll(async () => planning?.stop());

  it('starts one sprint at a time and closes it with the completion snapshot', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services, sql } = planning;
    const ana = await planning.user('Ana');
    const projectId = await planning.project('SPR', 'scrum', [[ana, 'member']]);
    const as = planning.ctx(ana);
    const first = await services.sprints.create(as, 'SPR', { name: 'Sprint 1' });
    const second = await services.sprints.create(as, projectId, { name: 'Sprint 2' });
    const [one, two, three] = [
      await planning.issue(as, { projectId, title: 'One', estimate: 3, sprintId: first.id }),
      await planning.issue(as, { projectId, title: 'Two', estimate: 5, sprintId: first.id }),
      await planning.issue(as, { projectId, title: 'Three', estimate: 2, sprintId: first.id }),
    ];
    const started = await services.sprints.start(as, first.id, {});
    expect(started).toMatchObject({ state: 'active' });
    expect(started.startedAt).not.toBeNull();
    expect(Date.parse(started.endsAt ?? '') - Date.parse(started.startsAt ?? '')).toBe(
      14 * 24 * 60 * 60 * 1000,
    );
    await expect(services.sprints.start(as, second.id, {})).rejects.toThrow(ConflictError);

    await planning.setStatus(one!.key, 'Done');
    const late = await planning.issue(as, { projectId, title: 'Late', estimate: 1 });
    await services.backlog.move(as, late.key, { sprintId: first.id, afterIssueId: one!.id });

    const closed = await services.sprints.complete(as, first.id, { moveUnfinishedTo: 'next' });
    expect(closed.state).toBe('closed');
    expect(closed.completedSnapshot).toMatchObject({
      committedPoints: 10,
      committedIssues: 3,
      completedPoints: 3,
      completedIssues: 1,
      carriedOverTo: second.id,
    });
    const [metric] = await sql<{ data: { completedPoints: number } }[]>`
      select data from sprint_metrics
      where scope_kind = 'sprint' and scope_id = ${first.id} and kind = 'completion'`;
    expect(metric?.data.completedPoints).toBe(3);
    const moved = await sql<{ key: string; sprint_id: string }[]>`
      select key, sprint_id from issues where project_id = ${projectId} order by number`;
    expect(moved.map((row) => [row.key, row.sprint_id === second.id])).toEqual([
      [one!.key, false],
      [two!.key, true],
      [three!.key, true],
      [late.key, true],
    ]);
    const carried = await sql<{ count: number }[]>`
      select count(*)::int as count from issue_history
      where field = 'sprintId' and to_value = ${JSON.stringify(second.id)}::jsonb`;
    expect(carried[0]?.count).toBe(3);
    const actions = await sql<{ action: string }[]>`
      select action from audit_log where target_kind = 'sprint' order by id`;
    expect(actions.map((row) => row.action)).toEqual([
      'sprint.created',
      'sprint.created',
      'sprint.started',
      'sprint.completed',
    ]);
    expect(
      planning.messages.some((m) => m.kind === 'work.sprint' && m.ids.includes(second.id)),
    ).toBe(true);

    await expect(services.sprints.start(as, second.id, {})).resolves.toMatchObject({
      state: 'active',
    });
    await expect(services.sprints.update(as, first.id, { name: 'Renamed' })).rejects.toThrow(
      ConflictError,
    );
  });

  it('keeps Kanban projects and outsiders from starting sprints', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services } = planning;
    const ben = await planning.user('Ben');
    const eve = await planning.user('Eve');
    const projectId = await planning.project('KAN', 'kanban', [[ben, 'member']]);
    const sprint = await services.sprints.create(planning.ctx(ben), projectId, { name: 'Flow' });
    await expect(services.sprints.start(planning.ctx(eve), sprint.id, {})).rejects.toThrow(
      ForbiddenError,
    );
    await expect(services.sprints.start(planning.ctx(ben), sprint.id, {})).rejects.toThrow(
      ValidationError,
    );
  });

  it('moves issues between sprints and the backlog in rank order', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services } = planning;
    const cy = await planning.user('Cy');
    const projectId = await planning.project('BKL', 'scrum', [[cy, 'member']]);
    const as = planning.ctx(cy);
    const sprint = await services.sprints.create(as, projectId, {
      name: 'Next',
      capacityPoints: 8,
    });
    const [a, b, c, d] = [
      await planning.issue(as, { projectId, title: 'A', estimate: 2 }),
      await planning.issue(as, { projectId, title: 'B', estimate: 3 }),
      await planning.issue(as, { projectId, title: 'C', estimate: 5 }),
      await planning.issue(as, { projectId, title: 'D' }),
    ];
    const keys = (issues: { key: string }[]) => issues.map((issue) => issue.key);

    await services.backlog.move(as, c!.key, { sprintId: sprint.id });
    await services.backlog.move(as, a!.key, { sprintId: sprint.id, beforeIssueId: c!.id });
    await services.backlog.move(as, d!.key, { beforeIssueId: null, afterIssueId: b!.id });
    let backlog = await services.backlog.get(as, 'BKL');
    expect(keys(backlog.sprints[0]!.issues)).toEqual([c!.key, a!.key]);
    expect(backlog.sprints[0]).toMatchObject({ committedPoints: 7, committedIssues: 2 });
    expect(backlog.sprints[0]!.sprint.capacityPoints).toBe(8);
    expect(keys(backlog.issues)).toEqual([d!.key, b!.key]);

    await services.backlog.move(as, c!.key, { sprintId: null, beforeIssueId: d!.id });
    backlog = await services.backlog.get(as, projectId);
    expect(keys(backlog.sprints[0]!.issues)).toEqual([a!.key]);
    expect(keys(backlog.issues)).toEqual([d!.key, c!.key, b!.key]);

    const other = await planning.project('OTH', 'scrum', [[cy, 'member']]);
    const foreign = await services.sprints.create(as, other, { name: 'Elsewhere' });
    await expect(services.backlog.move(as, b!.key, { sprintId: foreign.id })).rejects.toThrow(
      ValidationError,
    );
  });
});

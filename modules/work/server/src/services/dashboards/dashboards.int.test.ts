import { ForbiddenError, NotFoundError, ValidationError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPlanning, type Planning } from '../boards/planning-harness.ts';
import { createQuarterService } from '../reports/quarter-service.ts';

describe('dashboards and the quarter view against a real database', () => {
  let planning: Planning | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startPlanning();
    if ('planning' in started) planning = started.planning;
    else skipReason = started.reason;
  });
  afterAll(async () => planning?.stop());

  it('keeps each dashboard to its owner and its layout as written', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services } = planning;
    const [ana, ben, eve] = [
      await planning.user('Ana'),
      await planning.user('Ben'),
      await planning.user('Eve'),
    ];
    const projectId = await planning.project('DSH', 'scrum', [
      [ana, 'member'],
      [ben, 'member'],
    ]);
    const [asAna, asBen, asEve] = [planning.ctx(ana), planning.ctx(ben), planning.ctx(eve)];

    const board = await services.dashboards.create(asAna, { name: 'Team', projectId: 'DSH' });
    expect(board).toMatchObject({ ownerId: ana, projectId, name: 'Team' });
    expect(board.widgets.map((widget) => widget.type)).toEqual([
      'burndown',
      'burnup',
      'velocity',
      'cumulative-flow',
      'quarter',
    ]);
    expect(new Set(board.widgets.map((widget) => widget.id)).size).toBe(5);

    expect(await services.dashboards.list(asBen, { projectId: 'DSH' })).toEqual([]);
    await expect(services.dashboards.get(asBen, board.id)).rejects.toThrow(NotFoundError);
    await expect(services.dashboards.list(asEve, { projectId: 'DSH' })).rejects.toThrow(
      ForbiddenError,
    );

    const [first, second, ...rest] = board.widgets;
    const moved = await services.dashboards.update(asAna, board.id, {
      name: 'Sprint health',
      widgets: [second!, { ...first!, size: 'full' }, ...rest.slice(0, 2)],
    });
    expect(moved.name).toBe('Sprint health');
    expect(moved.widgets.map((widget) => [widget.id, widget.size])).toEqual([
      [second!.id, 'half'],
      [first!.id, 'full'],
      [rest[0]!.id, 'half'],
      [rest[1]!.id, 'half'],
    ]);
    await expect(
      services.dashboards.update(asAna, board.id, { widgets: [first!, first!] }),
    ).rejects.toThrow(ValidationError);

    const pinned = await services.dashboards.addWidget(asAna, board.id, {
      widget: {
        type: 'pinned',
        size: 'half',
        config: { spec: { version: 1, title: 'Bugs by owner', kind: 'chart.bar', params: {} } },
      },
      position: 0,
    });
    const pin = pinned.widgets[0]!;
    expect(pin).toMatchObject({ type: 'pinned', config: { spec: { source: 'assistant' } } });
    await services.dashboards.removeWidget(asAna, board.id, pin.id);
    await expect(services.dashboards.removeWidget(asAna, board.id, pin.id)).rejects.toThrow(
      NotFoundError,
    );
    expect((await services.dashboards.get(asAna, board.id)).widgets).toHaveLength(4);

    const kanban = await planning.project('KAN', 'kanban', [[ana, 'member']]);
    const flow = await services.dashboards.create(asAna, { name: 'Flow', projectId: kanban });
    expect(flow.widgets[0]?.type).toBe('cumulative-flow');
    const empty = await services.dashboards.create(asAna, {
      name: 'Blank',
      projectId: 'DSH',
      widgets: [],
    });
    expect(empty.widgets).toEqual([]);
    expect(
      (await services.dashboards.list(asAna, { projectId: 'DSH' })).map((item) => item.name),
    ).toEqual(['Sprint health', 'Blank']);

    await expect(services.dashboards.remove(asBen, board.id)).rejects.toThrow(NotFoundError);
    await services.dashboards.remove(asAna, board.id);
    await expect(services.dashboards.get(asAna, board.id)).rejects.toThrow(NotFoundError);
  });

  it('reads a quarter of sprints, epics and finished work', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { sql } = planning;
    const ana = await planning.user('Quinn');
    const projectId = await planning.project('QTR', 'scrum', [[ana, 'member']]);
    const asAna = planning.ctx(ana);
    const [epicType] = await sql<{ id: string }[]>`
      select id from issue_types where project_id is null and level = 'epic' limit 1`;
    const epic = await planning.issue(asAna, {
      projectId,
      title: 'Billing',
      typeId: epicType!.id,
      customFields: { target_date: '2026-12-31', owner: ana },
    });
    const open = await planning.issue(asAna, { projectId, title: 'Invoices', parentId: epic.id });
    const shipped = await planning.issue(asAna, { projectId, title: 'Refunds', parentId: epic.id });
    await planning.setStatus(shipped.key, 'Done');
    await sql`update issues set estimate = 3 where id = ${open.id}`;
    await sql`update issues set estimate = 5, resolved_at = now() where id = ${shipped.id}`;
    await sql`
      insert into sprints (project_id, name, state, started_at)
      values (${projectId}, 'Sprint 1', 'active', now() - interval '1 day')`;

    const quarter = createQuarterService(planning.deps());
    const report = await quarter.quarter(asAna, 'QTR', {});
    expect(report.weeks.at(-1)).toMatchObject({
      scopeIssues: 2,
      completedIssues: 1,
      scopePoints: 8,
      completedPoints: 5,
    });
    expect(report.sprints.map((sprint) => sprint.name)).toEqual(['Sprint 1']);
    expect(report.epics).toEqual([
      expect.objectContaining({ key: epic.key, issues: 2, doneIssues: 1, completedInQuarter: 1 }),
    ]);
    const outsider = planning.ctx(await planning.user('Olive'));
    await expect(quarter.quarter(outsider, 'QTR', {})).rejects.toThrow(ForbiddenError);
  });
});

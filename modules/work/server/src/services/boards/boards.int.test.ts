import { ForbiddenError, ValidationError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BoardConfig } from '../../../../shared/boards.ts';
import { startPlanning, type Planning } from './planning-harness.ts';

describe('boards against a real database', () => {
  let planning: Planning | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startPlanning();
    if ('planning' in started) planning = started.planning;
    else skipReason = started.reason;
  });
  afterAll(async () => planning?.stop());

  it('groups the board by column and lane in rank order', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services, sql } = planning;
    const ana = await planning.user('Ana');
    const ben = await planning.user('Ben');
    const projectId = await planning.project('BRD', 'kanban', [
      [ana, 'project_admin'],
      [ben, 'member'],
    ]);
    const asAna = planning.ctx(ana);
    const asBen = planning.ctx(ben);

    const [board] = await services.boards.listForProject(asBen, 'BRD');
    expect(board!.config.columns.map((column) => column.name)).toEqual([
      'Backlog',
      'Selected',
      'In progress',
      'Code review',
      'Testing',
      'Done',
    ]);
    expect(await services.boards.listForProject(asBen, projectId)).toHaveLength(1);

    const [epicType] = await sql<{ id: string }[]>`
      select id from issue_types where project_id is null and key = 'epic'`;
    const epic = await planning.issue(asAna, {
      projectId,
      typeId: epicType!.id,
      title: 'Checkout',
      dueAt: '2026-12-01',
      customFields: { target_date: '2026-12-01', owner: ana },
    });
    const hot = await planning.issue(asAna, {
      projectId,
      title: 'Hot',
      assigneeId: ana,
      priority: 'high',
      parentId: epic.id,
    });
    const doing = await planning.issue(asAna, { projectId, title: 'Doing', assigneeId: ben });
    const waiting = await planning.issue(asAna, { projectId, title: 'Waiting' });
    const shipped = await planning.issue(asAna, { projectId, title: 'Shipped' });
    await planning.setStatus(hot.key, 'In progress');
    await planning.setStatus(doing.key, 'In progress');
    await planning.setStatus(shipped.key, 'Done');

    const withLanes = (config: BoardConfig, lanes: Partial<BoardConfig['lanes']>): BoardConfig => ({
      ...config,
      lanes: { ...config.lanes, ...lanes },
    });
    const wip = {
      ...board!.config,
      columns: board!.config.columns.map((column) =>
        column.name === 'In progress' ? { ...column, wipLimit: 1 } : column,
      ),
    };
    await expect(services.boards.update(asBen, board!.id, { config: wip })).rejects.toThrow(
      ForbiddenError,
    );
    await services.boards.update(asAna, board!.id, { config: wip });
    await services.boards.update(asAna, board!.id, {
      config: withLanes(wip, { kind: 'assignee' }),
    });

    let view = await services.boards.view(asBen, board!.id, {});
    const counts = Object.fromEntries(view.columns.map((column) => [column.id, column]));
    expect(counts['backlog']).toMatchObject({ count: 1, overWip: false });
    expect(counts['in-progress']).toMatchObject({ count: 2, wipLimit: 1, overWip: true });
    expect(counts['done']).toMatchObject({ count: 1 });
    expect(view.lanes.map((lane) => lane.label)).toEqual(['Ana', 'Ben', 'Unassigned']);
    expect(view.cards.map((card) => [card.key, card.columnId, card.laneId])).toEqual([
      [hot.key, 'in-progress', ana],
      [doing.key, 'in-progress', ben],
      [waiting.key, 'backlog', 'none'],
      [shipped.key, 'done', 'none'],
    ]);
    expect(view.metrics.wipCount).toBe(2);

    view = await services.boards.view(asAna, board!.id, { q: 'assignee = me' });
    expect(view.cards.map((card) => card.key)).toEqual([hot.key]);

    await services.boards.update(asAna, board!.id, {
      config: withLanes(wip, {
        kind: 'query',
        queries: [{ name: 'Hot', query: 'priority = high' }],
      }),
    });
    view = await services.boards.view(asBen, board!.id, {});
    expect(view.cards.map((card) => card.laneId)).toEqual(['query-0', 'none', 'none', 'none']);

    await services.boards.update(asAna, board!.id, { config: withLanes(wip, { kind: 'epic' }) });
    view = await services.boards.view(asBen, board!.id, {});
    expect(view.lanes.map((lane) => [lane.label, lane.issueKey, lane.dueAt])).toEqual([
      ['Checkout', epic.key, '2026-12-01'],
      ['No epic', null, null],
    ]);
    expect(view.cards.find((card) => card.key === hot.key)?.laneId).toBe(epic.id);
    expect(view.cards.some((card) => card.key === epic.key)).toBe(false);

    await expect(
      services.boards.update(asAna, board!.id, {
        config: withLanes(wip, {
          kind: 'query',
          queries: [{ name: 'Bad', query: 'colour = red' }],
        }),
      }),
    ).rejects.toThrow(ValidationError);
    await expect(
      services.boards.update(asAna, board!.id, {
        config: {
          ...wip,
          columns: [...wip.columns, { ...wip.columns[0]!, id: 'again', name: 'Again' }],
        },
      }),
    ).rejects.toThrow(ValidationError);

    const audits = await sql<{ action: string }[]>`
      select action from audit_log where target_kind = 'board' order by id`;
    expect(audits.map((row) => row.action)).toEqual([
      'board.updated',
      'board.updated',
      'board.updated',
      'board.updated',
    ]);
    expect(
      planning.messages.filter((m) => m.kind === 'work.board' && m.ids.includes(board!.id)),
    ).not.toHaveLength(0);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Backlog } from '../../../../shared/backlog.ts';
import { startPlanning, type Planning } from '../boards/planning-harness.ts';

/*
 * The backlog's sort rules, filters and query, and the board's query order, against a real
 * database: the LQL compiles to the same SQL either way, custom fields included.
 */

const keysOf = (backlog: Backlog) => backlog.issues.map((issue) => issue.key);

describe('backlog queries and sort rules against a real database', () => {
  let planning: Planning | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startPlanning();
    if ('planning' in started) planning = started.planning;
    else skipReason = started.reason;
  });
  afterAll(async () => planning?.stop());

  it('sorts by the rules before rank, filters by the query, and keeps committed points', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services, sql } = planning;
    const ana = await planning.user('Ana');
    const projectId = await planning.project('BLQ', 'scrum', [[ana, 'project_admin']]);
    const as = planning.ctx(ana);
    const [bugType] = await sql<{ id: string }[]>`
      select id from issue_types where project_id is null and key = 'bug'`;
    const first = await planning.issue(as, { projectId, title: 'First', priority: 'low' });
    const support = await planning.issue(as, {
      projectId,
      typeId: bugType!.id,
      title: 'Support request',
      priority: 'low',
      customFields: {
        severity: 'sev3',
        environment: 'production',
        steps_to_reproduce: { type: 'doc', content: [] },
      },
    });
    const urgent = await planning.issue(as, { projectId, title: 'Urgent', priority: 'highest' });
    const last = await planning.issue(as, { projectId, title: 'Last', priority: 'low' });
    await sql`update issues set custom_fields = '{"target_date": "2026-03-01"}'
      where id = ${last.id}`;
    await sql`update issues set custom_fields = '{"target_date": "2026-05-01"}'
      where id = ${first.id}`;

    const ranked = await services.backlog.get(as, 'BLQ');
    expect(keysOf(ranked)).toEqual([first.key, support.key, urgent.key, last.key]);
    expect(ranked.sorted).toBe(false);

    const [board] = await services.boards.listForProject(as, 'BLQ');
    await services.boards.update(as, board!.id, {
      config: {
        ...board!.config,
        backlog: {
          sortRules: [
            { kind: 'match', name: 'Bugs', query: 'type = Bug' },
            { kind: 'field', field: 'priority', direction: 'desc' },
          ],
          filters: [{ name: 'Dated', query: 'cf.target_date IS NOT EMPTY' }],
        },
      },
    });
    const sorted = await services.backlog.get(as, 'BLQ');
    expect(sorted.sorted).toBe(true);
    expect(sorted.boardId).toBe(board!.id);
    expect(keysOf(sorted)).toEqual([support.key, urgent.key, first.key, last.key]);

    // A custom field filters and, through ORDER BY, sorts after the rules.
    const dated = await services.backlog.get(as, 'BLQ', {
      q: 'cf.target_date IS NOT EMPTY ORDER BY cf.target_date ASC',
    });
    expect(keysOf(dated)).toEqual([last.key, first.key]);

    const sprint = await services.sprints.create(as, 'BLQ', { name: 'BLQ Sprint 1' });
    await services.backlog.move(as, urgent.key, { sprintId: sprint.id });
    await services.issues.update(as, urgent.key, { estimate: 5 });
    const narrowed = await services.backlog.get(as, 'BLQ', { q: 'type = Bug' });
    expect(narrowed.sprints[0]).toMatchObject({ issues: [], committedPoints: 5 });
    expect(keysOf(narrowed)).toEqual([support.key]);
  });

  it('refuses a sort rule or query that is not valid LQL', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services } = planning;
    const ana = await planning.user('Bo');
    await planning.project('BLR', 'scrum', [[ana, 'project_admin']]);
    const as = planning.ctx(ana);
    const [board] = await services.boards.listForProject(as, 'BLR');
    await expect(
      services.boards.update(as, board!.id, {
        config: {
          ...board!.config,
          backlog: { sortRules: [{ kind: 'field', field: 'nonsense' }], filters: [] },
        },
      }),
    ).rejects.toThrow();
    await expect(services.backlog.get(as, 'BLR', { q: 'nonsense = 1' })).rejects.toThrow();
  });

  it('orders board cards by the query and pages them in that order', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services } = planning;
    const ana = await planning.user('Cy');
    const projectId = await planning.project('BLS', 'kanban', [[ana, 'project_admin']]);
    const as = planning.ctx(ana);
    const low = await planning.issue(as, { projectId, title: 'Low', priority: 'low' });
    const high = await planning.issue(as, { projectId, title: 'High', priority: 'high' });
    const [board] = await services.boards.listForProject(as, 'BLS');
    const view = await services.boards.view(as, board!.id, { q: 'ORDER BY priority DESC' });
    const index = (key: string) => view.cards.find((card) => card.key === key)?.sortIndex;
    expect(index(high.key)).toBe(0);
    expect(index(low.key)).toBe(1);
    const plain = await services.boards.view(as, board!.id, {});
    expect(plain.cards.every((card) => card.sortIndex === null)).toBe(true);
  });
});

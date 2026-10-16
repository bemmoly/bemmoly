import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPlanning, type Planning } from '../boards/planning-harness.ts';

describe('field statistics against a real database', () => {
  let planning: Planning | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startPlanning();
    if ('planning' in started) planning = started.planning;
    else skipReason = started.reason;
  });
  afterAll(async () => planning?.stop());

  /*
   * A (high, Ana, label ui), B (low, nobody), C (high, nobody, labels ui and api) and D
   * deleted; D must count nowhere.
   */
  it('counts live issues by one field and by two crossed', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { sql, services } = planning;
    const ana = await planning.user('Ana');
    const projectId = await planning.project('STA', 'kanban', [[ana, 'member']]);
    const as = planning.ctx(ana);
    const [a, b, c, d] = [
      await planning.issue(as, { projectId, title: 'A' }),
      await planning.issue(as, { projectId, title: 'B' }),
      await planning.issue(as, { projectId, title: 'C' }),
      await planning.issue(as, { projectId, title: 'D' }),
    ];
    await sql`update issues set priority = 'high', assignee_id = ${ana} where id = ${a.id}`;
    await sql`update issues set priority = 'low', assignee_id = null where id = ${b.id}`;
    await sql`update issues set priority = 'high', assignee_id = null where id = ${c.id}`;
    await sql`update issues set priority = 'high', assignee_id = ${ana}, deleted_at = now()
      where id = ${d.id}`;
    const [ui, api] = await sql<{ id: string }[]>`
      insert into labels (project_id, name) values (${projectId}, 'ui'), (${projectId}, 'api')
      returning id`;
    await sql`insert into issue_labels (issue_id, label_id) values
      (${a.id}, ${ui!.id}), (${c.id}, ${ui!.id}), (${c.id}, ${api!.id}), (${d.id}, ${api!.id})`;

    const byPriority = await services.stats.stats(as, 'STA', { by: 'priority' });
    expect(byPriority).toMatchObject({ by: 'priority', by2: null, total: 3 });
    expect(byPriority.rows).toEqual([
      { id: 'high', label: 'High', count: 2 },
      { id: 'low', label: 'Low', count: 1 },
    ]);

    const byLabel = await services.stats.stats(as, 'STA', { by: 'label' });
    expect(byLabel.rows.map((row) => [row.label, row.count])).toEqual([
      ['ui', 2],
      ['api', 1],
      ['No label', 1],
    ]);

    const crossed = await services.stats.stats(as, 'STA', { by: 'assignee', by2: 'priority' });
    expect(crossed.rows).toEqual([
      { id: ana, label: 'Ana', count: 1 },
      { id: null, label: 'Unassigned', count: 2 },
    ]);
    expect(crossed.columns?.map((column) => column.id)).toEqual(['high', 'low']);
    expect(crossed.cells).toEqual(
      expect.arrayContaining([
        { row: ana, column: 'high', count: 1 },
        { row: null, column: 'high', count: 1 },
        { row: null, column: 'low', count: 1 },
      ]),
    );
    expect(crossed.cells).toHaveLength(3);
  });
});

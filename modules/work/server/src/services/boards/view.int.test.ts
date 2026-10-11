import type { EntitySummary, LinkRegistry } from '@bemmoly/core';
import { createQueryCounter, expectMaxQueries } from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BoardView } from '../../../../shared/boards.ts';
import { startPlanning, type Planning } from './planning-harness.ts';

/*
 * What each card of the board view carries beyond its own row, read as sets
 * in one statement, and the statement budget that keeps it so: a board of
 * many cards with labels, links and subtasks runs no more statements than a
 * board of one.
 */

/** On a warm metrics cache: the board, the membership check, the project, the cards, the cache. */
const VIEW_BUDGET = 5;

/** Docs that link an issue, as the Docs module would answer through the kernel, by issue id. */
const linked = new Map<string, string[]>();
const page = (title: string): EntitySummary => ({
  kind: 'page',
  id: title,
  title,
  path: `/docs/${title}`,
});
const links: Pick<LinkRegistry, 'referencesToMany'> = {
  referencesToMany: async (_ctx, targets) => {
    const items = new Map<string, EntitySummary[]>();
    for (const id of targets.ids) {
      const titles = linked.get(id);
      if (titles) items.set(id, titles.map(page));
    }
    // Work's own references to an issue are other issues, never docs.
    const own = new Map(targets.ids.map((id) => [id, [page('Another issue')]]));
    return [
      { source: 'work.issue', label: 'Issues', moduleId: 'work', items: own },
      { source: 'docs.page', label: 'Linked docs', moduleId: 'docs', items },
    ];
  },
};

describe('the board view against a real database', () => {
  const counter = createQueryCounter();
  let planning: Planning | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startPlanning({ onQuery: counter.record, links });
    if ('planning' in started) planning = started.planning;
    else skipReason = started.reason;
  });
  afterAll(async () => planning?.stop());

  it('gives each card its labels, open blockers, subtask counts and epic', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services, sql } = planning;
    const ana = await planning.user('Ana');
    const projectId = await planning.project('VEW', 'kanban', [[ana, 'project_admin']]);
    const as = planning.ctx(ana);
    const [board] = await services.boards.listForProject(as, 'VEW');
    await services.boards.update(as, board!.id, {
      config: { ...board!.config, lanes: { ...board!.config.lanes, kind: 'epic' } },
    });
    const [epicType] = await sql<{ id: string }[]>`
      select id from issue_types where project_id is null and key = 'epic'`;
    const epic = await planning.issue(as, {
      projectId,
      typeId: epicType!.id,
      title: 'Checkout',
      customFields: { target_date: '2026-12-01', owner: ana },
    });
    const [red, blue] = await sql<{ id: string }[]>`
      insert into labels (project_id, name) values (${projectId}, 'red'), (${projectId}, 'blue')
      returning id`;
    const card = await planning.issue(as, {
      projectId,
      title: 'Pay',
      parentId: epic.id,
      labelIds: [red!.id, blue!.id],
    });
    const open = await planning.issue(as, { projectId, title: 'Open blocker' });
    const closed = await planning.issue(as, { projectId, title: 'Closed blocker' });
    const gone = await planning.issue(as, { projectId, title: 'Deleted blocker' });
    const related = await planning.issue(as, { projectId, title: 'Only related' });
    await planning.setStatus(closed.key, 'Done');
    for (const [source, kind] of [
      [open, 'blocks'],
      [closed, 'blocks'],
      [gone, 'blocks'],
      [related, 'relates'],
    ] as const) {
      await sql`
        insert into issue_links (source_id, target_id, kind)
        values (${source.id}, ${card.id}, ${kind})`;
    }
    await sql`update issues set deleted_at = now() where id = ${gone.id}`;
    const finished = await planning.issue(as, { projectId, title: 'Sub one', parentId: card.id });
    await planning.issue(as, { projectId, title: 'Sub two', parentId: card.id });
    const dropped = await planning.issue(as, { projectId, title: 'Sub three', parentId: card.id });
    await planning.setStatus(finished.key, 'Done');
    await sql`update issues set deleted_at = now() where id = ${dropped.id}`;
    const old = await planning.issue(as, { projectId, title: 'Shipped long ago' });
    await planning.setStatus(old.key, 'Done');
    await sql`
      update issues set status_changed_at = now() - interval '30 days' where id = ${old.id}`;

    const view = await services.boards.view(as, board!.id, {});
    const pay = view.cards.find((entry) => entry.key === card.key);
    expect(pay).toMatchObject({
      labelIds: [red!.id, blue!.id],
      blockedBy: [open.key],
      subtasks: { done: 1, total: 2 },
      parentId: epic.id,
      laneId: epic.id,
    });
    expect(view.cards.find((entry) => entry.key === open.key)).toMatchObject({
      labelIds: [],
      blockedBy: [],
      subtasks: null,
      laneId: 'none',
    });
    const keys = view.cards.map((entry) => entry.key);
    expect(keys).not.toContain(epic.key);
    expect(keys).not.toContain(old.key);
    expect(keys).toContain(closed.key);
    const ranks = view.cards.map((entry) => entry.rank);
    expect(ranks).toEqual([...ranks].sort());
    expect(view.lanes.map((lane) => lane.label)).toEqual(['Checkout', 'No epic']);
    expect(pay).toMatchObject({ epicId: epic.id, reporterId: ana });
    expect(pay?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(view.epics).toEqual([{ id: epic.id, key: epic.key, color: expect.anything() }]);

    // The card layout saved in settings is the one the view hands every card, and the epic
    // the "by epic" stripe paints from is there whatever the lanes.
    const saved = await services.boards.update(as, board!.id, {
      config: {
        ...view.board.config,
        lanes: { ...view.board.config.lanes, kind: 'none' },
        cardFields: ['labels', 'estimate', 'due', 'age'],
        colorRule: 'epic',
        colorRules: [{ query: 'priority = High', color: '#c42d2d' }],
      },
    });
    const flat = await services.boards.view(as, board!.id, {});
    expect(flat.board.config).toEqual(saved.config);
    expect(flat.board.config).toMatchObject({
      cardFields: ['labels', 'estimate', 'due', 'age'],
      colorRule: 'epic',
    });
    expect(flat.cards.find((entry) => entry.key === card.key)).toMatchObject({
      epicId: epic.id,
      laneId: 'all',
    });
    expect(flat.epics.map((entry) => entry.key)).toEqual([epic.key]);
    // Linked docs are asked for only while the board shows them.
    linked.set(card.id, ['Payments RFC', 'Refund spec']);
    expect(flat.cards.find((entry) => entry.key === card.key)?.docs).toEqual([]);
    await services.boards.update(as, board!.id, {
      config: { ...saved.config, cardFields: ['docs'] },
    });
    const withDocs = await services.boards.view(as, board!.id, {});
    expect(withDocs.cards.find((entry) => entry.key === card.key)?.docs).toEqual([
      'Payments RFC',
      'Refund spec',
    ]);
    expect(withDocs.cards.find((entry) => entry.key === open.key)?.docs).toEqual([]);
  });

  it('reads a board of many cards in as many statements as a board of one', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services, sql } = planning;
    const ben = await planning.user('Ben');
    const projectId = await planning.project('QRY', 'kanban', [[ben, 'project_admin']]);
    const as = planning.ctx(ben);
    const [board] = await services.boards.listForProject(as, 'QRY');
    const [label] = await sql<{ id: string }[]>`
      insert into labels (project_id, name) values (${projectId}, 'hot') returning id`;
    const first = await planning.issue(as, { projectId, title: 'First' });

    // The first read fills the metrics cache; the second is the one a refetch costs.
    const statementsOfView = async (): Promise<{ count: number; view: BoardView }> => {
      await services.boards.view(as, board!.id, {});
      counter.reset();
      const view = await expectMaxQueries(counter, VIEW_BUDGET, () =>
        services.boards.view(as, board!.id, {}),
      );
      return { count: counter.count, view };
    };
    const one = await statementsOfView();
    expect(one.view.cards).toHaveLength(1);

    let previous = first;
    for (let i = 0; i < 24; i += 1) {
      const issue = await planning.issue(as, {
        projectId,
        title: `Card ${i}`,
        labelIds: [label!.id],
        ...(i % 3 === 0 ? { parentId: previous.id } : {}),
      });
      await sql`
        insert into issue_links (source_id, target_id, kind)
        values (${previous.id}, ${issue.id}, 'blocks')`;
      previous = issue;
    }
    const many = await statementsOfView();
    expect(many.view.cards).toHaveLength(25);
    expect(many.count).toBe(one.count);
  });
});

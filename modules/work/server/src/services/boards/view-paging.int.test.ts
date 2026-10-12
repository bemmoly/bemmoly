import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  boardsResponseSchema,
  boardViewSchema,
  type BoardView,
} from '../../../../shared/boards.ts';
import { startWorkHttp, type WorkHttp } from '../../testing/http-support.ts';
import { startWorkHarness, type WorkHarness } from '../int-support.ts';

/*
 * The board view pages each column through the real route: the first page of every column
 * with a cursor where a column goes on, the next page of one column from that cursor, the
 * named cards alone for a realtime patch, and counts that always cover every card.
 */

describe('the board view, paged per column', () => {
  let harness: WorkHarness | null = null;
  let http: WorkHttp | null = null;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startWorkHarness();
    if (started.available) {
      harness = started.harness;
      http = await startWorkHttp(harness);
    } else skipReason = started.reason;
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  const view = async (boardId: string, as: string, query: Record<string, string> = {}) => {
    const response = await http!.get(`/boards/${boardId}/view`, as, query);
    expect(response.statusCode, response.body).toBe(200);
    return boardViewSchema.parse(response.json());
  };
  const inColumn = (page: BoardView, columnId: string) =>
    page.cards.filter((card) => card.columnId === columnId).map((card) => card.key);

  it('pages a long column, keeps the counts whole and patches named cards', async (ctx) => {
    if (!harness || !http) return ctx.skip(skipReason);
    const { users, services, sql } = harness;
    const project = await services.projects.create(harness.as(users.admin), {
      key: 'PAG',
      name: 'Paging',
      method: 'kanban',
    });
    await sql`
      insert into project_members (project_id, user_id, role_id)
      select ${project.id}, ${users.member}, id from roles where key = 'member'`;
    const created = [];
    for (let i = 0; i < 7; i += 1) created.push(await harness.issue(project, `Card ${i}`));
    const boards = boardsResponseSchema.parse(
      (await http.get('/projects/PAG/boards', users.member)).json(),
    );
    const board = boards.items[0]!;
    const todo = board.config.columns[0]!.id;

    const first = await view(board.id, users.member, { limit: '3' });
    const todoColumn = first.columns.find((column) => column.id === todo)!;
    expect(todoColumn.count).toBe(7);
    expect(inColumn(first, todo)).toHaveLength(3);
    expect(todoColumn.nextCursor).not.toBeNull();
    // A column that fits in its page has no cursor.
    expect(first.columns.filter((column) => column.id !== todo).map((c) => c.nextCursor)).toEqual(
      first.columns.filter((column) => column.id !== todo).map(() => null),
    );

    const second = await view(board.id, users.member, {
      limit: '3',
      column: todo,
      cursor: todoColumn.nextCursor!,
    });
    expect(second.cards.every((card) => card.columnId === todo)).toBe(true);
    const third = await view(board.id, users.member, {
      limit: '3',
      column: todo,
      cursor: second.columns.find((column) => column.id === todo)!.nextCursor!,
    });
    expect(third.columns.find((column) => column.id === todo)!.nextCursor).toBeNull();
    const paged = [...inColumn(first, todo), ...inColumn(second, todo), ...inColumn(third, todo)];
    const whole = await view(board.id, users.member, { limit: '50' });
    expect(paged).toEqual(inColumn(whole, todo));
    expect(new Set(paged).size).toBe(7);
    expect(third.columns.find((column) => column.id === todo)!.count).toBe(7);

    // A realtime patch reads the cards it names, wherever they sit; one deleted is absent.
    const [kept, gone] = [created[5]!, created[6]!];
    await services.issues.remove(harness.as(users.admin), gone.key);
    const patch = await view(board.id, users.member, { issueIds: `${kept.id},${gone.id}` });
    expect(patch.cards.map((card) => card.key)).toEqual([kept.key]);
    expect(patch.columns.find((column) => column.id === todo)!.count).toBe(6);

    // The paging parameters are checked: a cursor pages one column, and only one it gave.
    const loose = await http.get(`/boards/${board.id}/view`, users.member, {
      cursor: todoColumn.nextCursor!,
    });
    expect(loose.statusCode).toBe(400);
    const forged = await http.get(`/boards/${board.id}/view`, users.member, {
      column: todo,
      cursor: 'not-a-cursor',
    });
    expect(forged.statusCode).toBe(400);
    const outsider = await http.get(`/boards/${board.id}/view`, users.outsider, { limit: '3' });
    expect(outsider.statusCode).toBe(403);
  });

  it('lands a card dropped at the end of a loaded page before the cards not loaded', async (ctx) => {
    if (!harness || !http) return ctx.skip(skipReason);
    const { users, services } = harness;
    const project = await services.projects.create(harness.as(users.admin), {
      key: 'PGD',
      name: 'Paged drops',
      method: 'kanban',
    });
    for (let i = 0; i < 5; i += 1) await harness.issue(project, `Card ${i}`);
    const boards = boardsResponseSchema.parse(
      (await http.get('/projects/PGD/boards', users.admin)).json(),
    );
    const board = boards.items[0]!;
    const todo = board.config.columns[0]!.id;
    const first = await view(board.id, users.admin, { limit: '2' });
    const [, last] = inColumn(first, todo);
    // The column's last card, three cards below the page's end.
    const moving = inColumn(await view(board.id, users.admin), todo).at(-1)!;
    const lastId = first.cards.find((card) => card.key === last)!.issueId;
    // Dropped under the last card this page shows, with nothing below it on screen.
    await services.issues.rank(harness.as(users.admin), moving, { beforeIssueId: lastId });
    const again = await view(board.id, users.admin, { limit: '3' });
    expect(inColumn(again, todo)).toEqual([...inColumn(first, todo), moving]);
  });
});

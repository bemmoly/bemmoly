import {
  armDropTimer,
  BOARD_VIEW_BUDGET_MS,
  DROP_TO_PAINT_LIMIT_MS,
  readDropTimer,
  seedBoard,
  summary,
} from '../support/budget.ts';
import { expect, test, uniqueKey } from '../support/fixtures.ts';

/*
 * The board budgets of tech design §20 on a 500-issue project, measured on a
 * quiet server after every other test. The numbers go to the report; the test
 * fails only when one is clearly over its budget.
 */
test.describe.configure({ mode: 'serial' });

const TOTAL = 500;
const VIEW_SAMPLES = 200;
/** Drops measured, after one that warms the board up and is not counted. */
const DROPS = 20;

test('the board of a 500-issue project stays within its budgets', async ({
  run,
  admin,
  apiFor,
  pageAs,
}, testInfo) => {
  test.setTimeout(240_000);
  const project = await admin.createProject({
    key: uniqueKey('BGT'),
    name: 'Board budget',
    method: 'kanban',
  });
  await admin.addMembers(project.key, [run.member.id, run.observer.id, run.driver.id]);
  const sam = await apiFor(run.member);
  const issues = await seedBoard([admin, sam], project, TOTAL, 100);
  const boardId = await admin.boardId(project.key);

  // The API: one person reading the board view, one request at a time, after a warm-up.
  const priya = await apiFor(run.observer);
  const view = () => priya.http.get(`/api/v1/work/boards/${boardId}/view`);
  const first = await (await view()).json();
  expect(first.cards).toHaveLength(TOTAL);
  for (let i = 0; i < 20; i += 1) await view();
  const api: number[] = [];
  for (let i = 0; i < VIEW_SAMPLES; i += 1) {
    const started = performance.now();
    const response = await view();
    await response.body();
    api.push(performance.now() - started);
    expect(response.ok()).toBe(true);
  }

  // The screen: a drop to the frame that shows the card in its new column, while the
  // server's answer is held back so only an optimistic board can be that fast.
  const page = await pageAs(run.driver);
  await page.route(/\/api\/v1\/work\/issues\/[^/]+$/, async (route) => {
    if (route.request().method() === 'PATCH') await new Promise((r) => setTimeout(r, 600));
    await route.continue().catch(() => undefined);
  });
  await page.goto(`/work/board/${project.key}`);
  const column = (name: string) => page.getByRole('group', { name: `${name}, All issues` });
  await expect(column('Selected').locator('[data-issue-id]').first()).toBeVisible();
  const dragged = issues.slice(100, 101 + DROPS);
  const drops: number[] = [];
  for (const issue of dragged) {
    const card = page.locator(`[data-issue-id="${issue.id}"]`);
    await card.scrollIntoViewIfNeeded();
    await armDropTimer(page, issue.id, 'Selected, All issues');
    await card.dragTo(column('Selected'), { targetPosition: { x: 40, y: 12 } });
    const time = await readDropTimer(page);
    if (issue !== dragged[0]) drops.push(time);
    await expect(column('Selected').locator(`[data-issue-id="${issue.id}"]`)).toBeVisible();
  }
  // The server confirms every move after the frame that showed it.
  const dropped = new Set(dragged.map((issue) => issue.id));
  await expect
    .poll(async () => {
      const board = await admin.call<{ cards: { issueId: string; columnId: string }[] }>(
        'GET',
        `/work/boards/${boardId}/view`,
      );
      return board.cards.filter((card) => dropped.has(card.issueId) && card.columnId === 'selected')
        .length;
    })
    .toBe(dragged.length);

  const numbers = {
    issues: TOTAL,
    boardViewApiMs: { ...summary(api), budget: BOARD_VIEW_BUDGET_MS },
    dropToPaintMs: { ...summary(drops), limit: Number(DROP_TO_PAINT_LIMIT_MS.toFixed(1)) },
  };
  await testInfo.attach('board-budget.json', {
    body: JSON.stringify(numbers, null, 2),
    contentType: 'application/json',
  });
  process.stdout.write(`board budget: ${JSON.stringify(numbers)}\n`);
  expect(numbers.boardViewApiMs.p95).toBeLessThan(BOARD_VIEW_BUDGET_MS);
  expect(numbers.dropToPaintMs.p95).toBeLessThan(DROP_TO_PAINT_LIMIT_MS);
});

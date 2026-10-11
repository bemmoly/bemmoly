import { expect, test, uniqueKey } from '../support/fixtures.ts';

// Six columns beside the 240px sidebar: wide enough that the drag never needs to auto-scroll.
test.use({ viewport: { width: 1680, height: 900 } });

test('an issue moves across the board by drag and by keyboard, and a refused move says why', async ({
  page,
  admin,
}) => {
  const project = await admin.createProject({
    key: uniqueKey('BRD'),
    name: 'Board flow',
    method: 'kanban',
  });
  const [issue] = await admin.createIssues(project, ['Ship the login page']);
  if (!issue) throw new Error('no issue');

  await page.goto(`/work/board/${project.key}`);
  const card = page.getByRole('button', { name: `${issue.key} Ship the login page` });
  const column = (name: string) => page.getByRole('group', { name: `${name}, All issues` });
  await expect(
    column('Backlog').getByRole('button', { name: new RegExp(`^${issue.key} `) }),
  ).toBeVisible();

  // By pointer: Backlog → Selected, the workflow's "Select for sprint".
  await card.dragTo(column('Selected'));
  await expect(
    column('Selected').getByRole('button', { name: new RegExp(`^${issue.key} `) }),
  ).toBeVisible();
  await expect.poll(async () => (await admin.issue(issue.key)).statusId).not.toBe(issue.statusId);

  // By keyboard: space picks it up, the right arrow carries it, space drops it.
  await card.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect(
    column('In progress').getByRole('button', { name: new RegExp(`^${issue.key} `) }),
  ).toBeVisible();
  await expect(card).toBeFocused();

  // In progress → Testing skips code review, which the workflow has no transition for. Held
  // over Testing, the column says why; dropped, the card stays and the board says it again.
  const reason = 'No transition leads from this status to Testing';
  const box = async (name: string) => {
    const found = await column(name).boundingBox();
    if (!found) throw new Error(`no ${name} column`);
    return { x: found.x + found.width / 2, y: found.y + found.height / 2 };
  };
  const start = await box('In progress');
  const end = await box('Testing');
  await card.hover();
  await page.mouse.down();
  await page.mouse.move(start.x + 20, start.y, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await expect(column('Testing').getByText(reason)).toBeVisible();
  await page.mouse.up();
  const toast = page.getByRole('status').filter({ hasText: `${issue.key} cannot move to Testing` });
  await expect(toast).toContainText(reason);
  await expect(
    column('In progress').getByRole('button', { name: new RegExp(`^${issue.key} `) }),
  ).toBeVisible();
  await expect(
    column('Testing').getByRole('button', { name: new RegExp(`^${issue.key} `) }),
  ).toHaveCount(0);

  // The server agrees with the screen after a reload.
  await page.reload();
  await expect(
    column('In progress').getByRole('button', { name: new RegExp(`^${issue.key} `) }),
  ).toBeVisible();
});

test('cards follow the board for everyone, and quick filters toggle in the filter row', async ({
  page,
  admin,
  run,
  pageAs,
  apiFor,
}) => {
  const project = await admin.createProject({
    key: uniqueKey('CRD'),
    name: 'Card layout flow',
    method: 'kanban',
  });
  await admin.addMembers(project.key, [run.member.id]);
  await admin.createIssues(project, ['Tidy the release notes']);

  await page.goto(`/work/board/${project.key}`);
  const mine = page
    .getByRole('group', { name: 'Quick filters' })
    .getByRole('button', { name: 'Only my issues' });
  await expect(mine).toHaveAttribute('aria-pressed', 'false');
  await mine.click();
  await expect(mine).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/quick=mine/);
  await page.reload();
  await expect(mine).toHaveAttribute('aria-pressed', 'true');
  await mine.click();
  await expect(page).not.toHaveURL(/quick=/);

  // The admin is sent to Board settings › Cards from Display.
  await page.getByRole('button', { name: /^Display/ }).click();
  await expect(page.getByRole('menuitemcheckbox', { name: 'Key' })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Edit card layout in settings' }).click();
  await expect(page).toHaveURL(new RegExp(`/work/settings/${project.key}/board\\?tab=cards`));
  await expect(page.getByRole('heading', { name: 'Card layout' })).toBeVisible();

  // A member reads where the layout is set, and the server refuses their change.
  const memberPage = await pageAs(run.member);
  await memberPage.goto(`/work/board/${project.key}`);
  await memberPage.getByRole('button', { name: /^Display/ }).click();
  await expect(memberPage.getByText(/Card layout is set by project admins/)).toBeVisible();
  await expect(memberPage.getByRole('menuitem', { name: /Edit card layout/ })).toHaveCount(0);

  const boardId = await admin.boardId(project.key);
  const board = await admin.call<{ config: { cardFields: string[] } }>(
    'GET',
    `/work/boards/${boardId}`,
  );
  const member = await apiFor(run.member);
  const refused = await member.http.fetch(`/api/v1/work/boards/${boardId}`, {
    method: 'PATCH',
    data: { config: { ...board.config, cardFields: ['type'] } },
  });
  expect(refused.status()).toBe(403);
  const after = await admin.call<{ config: { cardFields: string[] } }>(
    'GET',
    `/work/boards/${boardId}`,
  );
  expect(after.config.cardFields).toEqual(board.config.cardFields);
});

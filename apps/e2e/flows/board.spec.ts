import { expect, test, uniqueKey } from '../support/fixtures.ts';

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
  await expect(column('Backlog').getByRole('button', { name: issue.key })).toBeVisible();

  // By pointer: Backlog → Selected, the workflow's "Select for sprint".
  await card.dragTo(column('Selected'));
  await expect(column('Selected').getByRole('button', { name: issue.key })).toBeVisible();
  await expect.poll(async () => (await admin.issue(issue.key)).statusId).not.toBe(issue.statusId);

  // By keyboard: space picks it up, the right arrow carries it, space drops it.
  await card.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect(column('In progress').getByRole('button', { name: issue.key })).toBeVisible();
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
  await expect(column('In progress').getByRole('button', { name: issue.key })).toBeVisible();
  await expect(column('Testing').getByRole('button', { name: issue.key })).toHaveCount(0);

  // The server agrees with the screen after a reload.
  await page.reload();
  await expect(column('In progress').getByRole('button', { name: issue.key })).toBeVisible();
});

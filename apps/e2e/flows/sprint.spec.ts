import type { Locator, Page } from '@playwright/test';
import { expect, test, uniqueKey } from '../support/fixtures.ts';

/** A pointer drag the way a hand makes one: press, travel past the threshold, glide, release. */
async function drag(page: Page, from: Locator, to: Locator) {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  if (!start || !end) throw new Error('nothing to drag between');
  await page.mouse.move(start.x + 40, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + 48, start.y + start.height / 2 + 8, { steps: 3 });
  await page.mouse.move(end.x + 40, end.y + end.height / 2, { steps: 15 });
  await page.mouse.up();
}

test('a sprint is planned in the backlog, started, and completed with its unfinished work moved', async ({
  page,
  admin,
}) => {
  const project = await admin.createProject({ key: uniqueKey('SPR'), name: 'Sprint flow' });
  const [login, receipts, later] = await admin.createIssues(project, [
    'Sign in with a passkey',
    'Email receipts',
    'Dark mode for invoices',
  ]);
  if (!login || !receipts || !later) throw new Error('no issues');
  const sprintName = `${project.key} Sprint 1`;

  await page.goto(`/work/backlog/${project.key}`);
  const backlog = page.getByRole('listbox', { name: 'Backlog' });
  await expect(backlog.getByRole('option')).toHaveCount(3);
  await page.getByRole('button', { name: 'Create sprint' }).first().click();
  const sprint = page.getByRole('listbox', { name: sprintName });
  await expect(page.getByText('Drag issues here to plan this sprint.')).toBeVisible();

  const row = (key: string) => page.getByRole('option', { name: new RegExp(` ${key} `) });
  await drag(page, row(login.key), page.getByText('Drag issues here to plan this sprint.'));
  await expect(sprint.getByRole('option', { name: new RegExp(` ${login.key} `) })).toBeVisible();
  await drag(page, row(receipts.key), sprint);
  await expect(sprint.getByRole('option')).toHaveCount(2);
  await expect(backlog.getByRole('option')).toHaveCount(1);
  await expect.poll(async () => (await admin.issue(receipts.key)).sprintId).not.toBeNull();

  await page.getByRole('button', { name: 'Start sprint' }).click();
  const start = page.getByRole('dialog', { name: `Start ${sprintName}` });
  await start.getByRole('textbox', { name: 'Sprint goal' }).fill('Passkeys and receipts');
  await start.getByRole('button', { name: 'Start sprint' }).click();
  await expect(start).toBeHidden();
  await expect(page.getByRole('button', { name: 'Complete sprint' })).toBeVisible();

  // The board shows the active sprint; one issue gets all the way to Done.
  await admin.walk(login.key, ['Selected', 'In progress', 'Code review', 'Testing', 'Done']);
  await page.goto(`/work/board/${project.key}`);
  await expect(page.getByText(sprintName).first()).toBeVisible();
  const done = page.getByRole('group', { name: /^Done, / });
  await expect(done.getByRole('button', { name: new RegExp(`^${login.key} `) })).toBeVisible();

  await page.goto(`/work/backlog/${project.key}`);
  await page.getByRole('button', { name: 'Complete sprint' }).click();
  const complete = page.getByRole('dialog', { name: `Complete ${sprintName}` });
  await expect(complete.getByText('Completed')).toBeVisible();
  await complete.getByRole('combobox').click();
  await page.getByRole('option', { name: `New sprint (${project.key} Sprint 2)` }).click();
  await complete.getByRole('button', { name: 'Complete sprint' }).click();
  await expect(complete).toBeHidden();

  const next = page.getByRole('listbox', { name: `${project.key} Sprint 2` });
  await expect(next.getByRole('option', { name: new RegExp(` ${receipts.key} `) })).toBeVisible();
  await expect(page.getByRole('listbox', { name: sprintName })).toHaveCount(0);
  await expect(backlog.getByRole('option', { name: new RegExp(` ${later.key} `) })).toBeVisible();
  const moved = await admin.issue(receipts.key);
  const finished = await admin.issue(login.key);
  expect(moved.sprintId).not.toBeNull();
  expect(moved.sprintId).not.toBe(finished.sprintId);
});

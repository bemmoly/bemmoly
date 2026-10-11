import type { Locator, Page } from '@playwright/test';
import { expect, test, uniqueKey } from '../support/fixtures.ts';

/*
 * The card layout an admin saves in Board settings › Cards is exactly what every card on the
 * board draws, for the admin and for a member, after a reload too. Nothing is mocked: the
 * settings page writes the board, the board reads it back from the server.
 */

const DUE = { iso: '2030-01-15', label: 'Due Jan 15, 2030' };

/** What a card draws, part by part, read from the screen. */
async function parts(card: Locator) {
  const has = async (locator: Locator) => (await locator.count()) > 0;
  return {
    type: await has(card.getByRole('img', { name: 'Task' })),
    priority: await has(card.getByRole('img', { name: /priority$/ })),
    estimate: await has(card.getByLabel('3 points')),
    due: await has(card.getByLabel(DUE.label)),
    label: await has(card.getByText('customer', { exact: true })),
    age: await has(card.getByTitle('Time in column')),
  };
}

/** The card's left stripe: its width and colour, as the browser paints them. */
const stripe = (card: Locator) =>
  card.locator('.group\\/card').evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: style.borderLeftWidth, color: style.borderLeftColor };
  });

async function expectSavedLayout(page: Page, keys: { rich: string; bare: string }) {
  const rich = page.getByRole('button', { name: new RegExp(`^${keys.rich} `) });
  const bare = page.getByRole('button', { name: new RegExp(`^${keys.bare} `) });
  await expect(rich).toBeVisible();
  await expect(rich.getByLabel(DUE.label)).toBeVisible();
  expect(await parts(rich)).toEqual({
    type: true,
    priority: false,
    estimate: true,
    due: true,
    label: true,
    age: false,
  });
  // The imported-looking issue has no estimate, due date or labels: nothing to draw.
  expect(await parts(bare)).toEqual({
    type: true,
    priority: false,
    estimate: false,
    due: false,
    label: false,
    age: false,
  });
  // By priority: a highest card and a low card each carry a 3px stripe, in different colours.
  const high = await stripe(rich);
  const low = await stripe(bare);
  expect(high.width).toBe('3px');
  expect(low.width).toBe('3px');
  expect(high.color).not.toBe(low.color);
}

test('the card layout saved in Board settings is what every card draws, for everyone', async ({
  page,
  admin,
  run,
  pageAs,
}) => {
  const project = await admin.createProject({
    key: uniqueKey('CLY'),
    name: 'Card layout',
    method: 'kanban',
  });
  await admin.addMembers(project.key, [run.member.id]);
  const typeId = await admin.typeId(project.key);
  const label = await admin.call<{ id: string }>('POST', `/work/projects/${project.key}/labels`, {
    name: 'customer',
  });
  const rich = await admin.call<{ key: string }>('POST', '/work/issues', {
    projectId: project.id,
    typeId,
    title: 'Refund a duplicate charge',
    priority: 'highest',
    estimate: 3,
    dueAt: DUE.iso,
    labelIds: [label.id],
  });
  const bare = await admin.call<{ key: string }>('POST', '/work/issues', {
    projectId: project.id,
    typeId,
    title: 'Imported without extras',
    priority: 'low',
  });
  const keys = { rich: rich.key, bare: bare.key };

  // Before: the default layout, priority on, no due date, no stripe.
  await page.goto(`/work/board/${project.key}`);
  const card = page.getByRole('button', { name: new RegExp(`^${rich.key} `) });
  await expect(card).toBeVisible();
  expect(await parts(card)).toMatchObject({ priority: true, due: false, age: false });
  expect((await stripe(card)).width).not.toBe('3px');

  await page.goto(`/work/settings/${project.key}/board?tab=cards`);
  const note = page.getByText(/^Based on Workspace board/);
  await expect(note).toHaveText(/with no changes yet for this project/);
  await page.getByRole('button', { name: 'Edit Card layout' }).click();
  for (const name of ['Estimate', 'Due date', 'Labels']) {
    await page.getByRole('checkbox', { name }).check();
  }
  await page.getByRole('checkbox', { name: 'Priority' }).uncheck();
  await page.getByRole('radio', { name: /^By priority/ }).click();
  // The preview is the board's own card: a due date, no priority bars.
  const preview = page.getByLabel('Card preview', { exact: true });
  await expect(preview.getByLabel(/^Due /)).toBeVisible();
  await expect(preview.getByRole('img', { name: /priority$/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Review and save' }).click();
  const review = page.getByRole('dialog', { name: 'Review changes' });
  await expect(review.getByText('Card fields')).toBeVisible();
  await expect(review.getByText('Card color')).toBeVisible();
  await review.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit Card layout' })).toBeVisible();
  await expect(note).toHaveText(/with 2 changes for this project/);

  // In the app, through the preview's link: the board reads the saved layout at once.
  await page.getByRole('link', { name: 'Open board' }).click();
  await expect(page).toHaveURL(new RegExp(`/work/board/${project.key}`));
  await expectSavedLayout(page, keys);

  await page.reload();
  await expectSavedLayout(page, keys);

  const member = await pageAs(run.member);
  await member.goto(`/work/board/${project.key}`);
  await expectSavedLayout(member, keys);
});

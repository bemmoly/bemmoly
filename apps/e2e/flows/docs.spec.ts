import type { Page } from '@playwright/test';
import { expect, test, uniqueKey } from '../support/fixtures.ts';

interface TreePage {
  items: { id: string; title: string }[];
}

/** The rows of the space sidebar's tree, top to bottom. */
const rows = (page: Page) => page.getByRole('tree').getByRole('treeitem');

/** Opens a row's ··· menu and chooses an item. */
async function rowAction(page: Page, title: string, action: string) {
  const row = page.getByRole('treeitem', { name: title, exact: true });
  await row.hover();
  await row.getByRole('button', { name: `Actions for ${title}` }).click();
  await page.getByRole('menuitem', { name: action }).click();
}

/** Drags one row onto the top quarter of another, where the drop line goes above it. */
async function dragAbove(page: Page, from: string, to: string) {
  const source = page.getByRole('treeitem', { name: from, exact: true });
  const target = page.getByRole('treeitem', { name: to, exact: true });
  const a = await source.boundingBox();
  const b = await target.boundingBox();
  if (!a || !b) throw new Error('rows are not on screen');
  await page.mouse.move(a.x + 40, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 40, b.y + 4, { steps: 12 });
  await expect(target.locator('[data-drop-line="before"]')).toBeVisible();
  await page.mouse.up();
}

test('a space is created, a page made from a template, reordered, starred, trashed and restored', async ({
  page,
  admin,
}) => {
  const key = uniqueKey('D');
  const name = `Runbooks ${key}`;

  // A space, from the Create menu's entry.
  await page.goto('/docs/spaces/new');
  const spaceDialog = page.getByRole('dialog', { name: 'Create space' });
  await spaceDialog.getByRole('textbox', { name: 'Name' }).fill(name);
  await spaceDialog.getByRole('textbox', { name: 'Key' }).fill(key);
  await spaceDialog.getByRole('button', { name: 'Create space' }).click();
  await expect(page).toHaveURL(new RegExp(`/docs/s/${key}$`));
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  await expect(page.getByText('Nothing written here yet')).toBeVisible();

  // A page from a template, through the picker.
  // The overview's own button; the space sidebar and the empty state offer the same picker.
  await page.getByRole('button', { name: 'New page', exact: true }).last().click();
  const pageDialog = page.getByRole('dialog', { name: 'New page' });
  await pageDialog.getByRole('button', { name: /^Runbook/ }).click();
  await pageDialog.getByRole('button', { name: 'Create page' }).click();
  await expect(page).toHaveURL(/\/docs\/p\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Runbook', level: 1 })).toBeVisible();

  // A blank page beside it, so there is an order to change.
  await page.getByRole('button', { name: 'New page' }).click();
  await pageDialog.getByRole('textbox', { name: 'Title' }).fill('Failover drill');
  await pageDialog.getByRole('textbox', { name: 'Title' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Failover drill', level: 1 })).toBeVisible();
  await expect(rows(page)).toHaveText(['Runbook', 'Failover drill']);

  // Reorder by dragging, then check the server kept it.
  await dragAbove(page, 'Failover drill', 'Runbook');
  await expect(rows(page)).toHaveText(['Failover drill', 'Runbook']);
  await expect
    .poll(async () =>
      (await admin.call<TreePage>('GET', `/docs/spaces/${key}/tree`)).items.map((p) => p.title),
    )
    .toEqual(['Failover drill', 'Runbook']);
  await page.reload();
  await expect(rows(page)).toHaveText(['Failover drill', 'Runbook']);

  // Star it; it shows on the home's Starred tab.
  await rowAction(page, 'Runbook', 'Star');
  await expect(page.getByText('Starred', { exact: true }).last()).toBeVisible();
  await page.goto('/docs');
  await page.getByRole('tab', { name: 'Starred' }).click();
  await expect(page.getByRole('tabpanel').getByRole('link', { name: /Runbook/ })).toBeVisible();

  // Trash it, then restore it from the space's trash.
  await page.goto(`/docs/s/${key}`);
  await rowAction(page, 'Runbook', 'Move to trash');
  await expect(page.getByText('“Runbook” moved to trash')).toBeVisible();
  await expect(rows(page)).toHaveText(['Failover drill']);
  await page.getByRole('link', { name: 'Trash' }).click();
  await expect(page).toHaveURL(new RegExp(`/docs/s/${key}/trash$`));
  const trashed = page.getByRole('list', { name: 'Pages in the trash' }).getByRole('listitem');
  await expect(trashed).toHaveCount(1);
  await trashed.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText('“Runbook” restored')).toBeVisible();
  await expect(page.getByText('The trash is empty')).toBeVisible();
  await expect(rows(page)).toHaveText(['Failover drill', 'Runbook']);
});

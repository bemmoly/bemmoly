import type { Page } from '@playwright/test';
import { expect, test, uniqueKey } from '../support/fixtures.ts';

interface TreePage {
  items: { id: string; title: string }[];
}

/** The rows of the current space's tree in the app sidebar, top to bottom. */
const rows = (page: Page) => page.getByRole('tree').getByRole('treeitem');

/** Opens a row's ··· menu and chooses an item. */
async function rowAction(page: Page, title: string, action: string) {
  const row = page.getByRole('treeitem', { name: title, exact: true });
  await row.hover();
  await row.getByRole('button', { name: `Actions for ${title}` }).click();
  await page.getByRole('menuitem', { name: action }).click();
}

/** A space's row in the sidebar's Docs section. */
const spaceRow = (page: Page, name: string) =>
  page.getByRole('region', { name: 'Docs' }).getByRole('link', { name, exact: true });

/** Opens a space row's ··· menu in the sidebar and chooses an item. */
async function spaceAction(page: Page, name: string, action: string) {
  await spaceRow(page, name).hover();
  await page.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: action, exact: true }).click();
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
  await expect(
    page.getByRole('heading', { name: `Write the first page in ${name}` }),
  ).toBeVisible();

  // The space is the open row in the sidebar, with one quiet row for its first page.
  await expect(spaceRow(page, name)).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: /^New page N$/ })).toBeVisible();

  // Blank page makes a page in place; a template from inside the empty page fills it.
  await page.getByRole('button', { name: /^Blank page/ }).click();
  await expect(page).toHaveURL(/\/docs\/p\/[0-9a-f-]{36}$/);
  const blankUrl = page.url();
  await page
    .getByRole('region', { name: 'Start from a template' })
    .getByRole('button', { name: /^Runbook/ })
    .click();
  await expect(page.getByRole('textbox', { name: 'Page title' })).toHaveValue('Runbook');
  // The template fills the same page: nothing new is made and nothing is thrown away.
  expect(page.url()).toBe(blankUrl);
  await expect(page.getByRole('region', { name: 'Start from a template' })).toHaveCount(0);
  await expect(page.getByRole('treeitem', { name: 'Runbook' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // A blank page beside it from the space row's +, made in place and named on the page.
  const runbookUrl = page.url();
  await spaceRow(page, name).hover();
  await page.getByRole('button', { name: `New page in ${name}` }).click();
  await expect(page).not.toHaveURL(runbookUrl);
  const title = page.getByRole('textbox', { name: 'Page title' });
  await title.fill('Failover drill');
  await title.press('Enter');
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
  await page.getByRole('radio', { name: /^Starred/ }).click();
  await expect(
    page.getByRole('list', { name: 'Pages' }).getByRole('link', { name: /Runbook/ }),
  ).toBeVisible();

  // Trash it, then restore it from the space's trash.
  await page.goto(`/docs/s/${key}`);
  await rowAction(page, 'Runbook', 'Move to trash');
  await expect(page.getByText('“Runbook” moved to trash')).toBeVisible();
  await expect(rows(page)).toHaveText(['Failover drill']);
  await spaceAction(page, name, 'Trash');
  await expect(page).toHaveURL(new RegExp(`/docs/s/${key}/trash$`));
  const trashed = page
    .getByRole('table')
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'Runbook', exact: true }) });
  await expect(trashed).toHaveCount(1);
  await expect(page.getByRole('table').getByRole('cell', { name: 'Untitled' })).toHaveCount(0);
  await trashed.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText(/^“Runbook” restored/)).toBeVisible();
  await expect(trashed).toHaveCount(0);
  await expect(rows(page)).toHaveText(['Failover drill', 'Runbook']);
});

test('a big space takes the sidebar in focus mode, with a filter, and gives it back', async ({
  page,
  admin,
}) => {
  const key = uniqueKey('F');
  const name = `Handbook ${key}`;
  const space = await admin.call<{ id: string }>('POST', '/docs/spaces', { key, name });
  for (const title of ['Onboarding', 'Expenses', 'Time off']) {
    await admin.call('POST', '/docs/pages', { spaceId: space.id, title });
  }
  await page.goto(`/docs/s/${key}`);
  await expect(rows(page)).toHaveText(['Onboarding', 'Expenses', 'Time off']);

  await spaceRow(page, name).dblclick();
  const filter = page.getByRole('searchbox', { name: `Filter ${name}` });
  await expect(filter).toBeFocused();
  await expect(page.getByRole('link', { name: 'Docs home' })).toHaveCount(0);
  await filter.fill('Expenses');
  await expect(page.getByRole('list', { name: 'Pages matching Expenses' })).toContainText(
    'Expenses',
  );

  // Focus is remembered across a reload, then Esc gives every space back.
  await page.reload();
  await expect(page.getByRole('button', { name: /All of Docs/ })).toBeVisible();
  await page.getByRole('searchbox', { name: `Filter ${name}` }).press('Escape');
  await expect(page.getByRole('link', { name: 'Docs home' })).toBeVisible();
});

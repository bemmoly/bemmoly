import type { Page } from '@playwright/test';
import { expect, test, uniqueKey } from '../support/fixtures.ts';

/** The New page dialog over a space, as the Create menu opens it there. */
async function openNewPage(page: Page, spaceKey: string) {
  await page.goto(`/docs/s/${spaceKey}?create=docs.create-page`);
  const dialog = page.getByRole('dialog', { name: 'New page' });
  await expect(dialog.getByRole('button', { name: /^Blank page/ })).toBeVisible();
  return dialog;
}

test('an org admin adds an org template that a member starts a page from, then archives it', async ({
  page,
  admin,
  run,
  pageAs,
}) => {
  const key = uniqueKey('OT');
  const name = `Launch checklist ${key}`;
  // A space the member writes in, made through the API: the flow under test is the template.
  await admin.call('POST', '/docs/spaces', { key, name: `Launches ${key}` });
  await admin.call('POST', `/docs/spaces/${key}/members`, { userIds: [run.member.id] });

  // Settings › Docs: a new org template, written in the editor.
  await page.goto('/settings/docs');
  await expect(page.getByRole('heading', { name: 'Org templates' })).toBeVisible();
  await expect(page.getByText('Spaces can add their own templates.')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Org templates' })).toContainText('RFC');
  await page.getByRole('button', { name: 'New template' }).click();
  await expect(page).toHaveURL(/\?template=new&edit=1$/);
  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('textbox', { name: 'Category' }).fill('Launches');
  await page.getByRole('textbox', { name: 'Description' }).fill('Everything a launch needs.');
  await page.getByRole('button', { name: 'Add field' }).click();
  await page.getByRole('textbox', { name: 'Field label' }).fill('Launch date');
  const body = page.getByRole('textbox', { name: 'Template body' });
  await body.click();
  await page.keyboard.type('Owner, date and rollback plan.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\?template=[0-9a-f-]{36}$/);
  await expect(page.getByRole('region', { name: 'Preview' })).toContainText(
    'Owner, date and rollback plan.',
  );

  // The member sees it in the picker of a space they write in, and starts a page from it.
  const sam = await pageAs(run.member);
  const picker = await openNewPage(sam, key);
  const card = picker.getByRole('button', { name: new RegExp(name) });
  await expect(card).toBeVisible();
  await card.click();
  await picker.getByRole('button', { name: 'Create page' }).click();
  await expect(sam).toHaveURL(/\/docs\/p\/[0-9a-f-]{36}$/);
  await expect(sam.getByRole('textbox', { name: 'Page title' })).toHaveValue(name);
  await expect(sam.getByRole('textbox', { name: 'Page body' })).toContainText(
    'Owner, date and rollback plan.',
  );

  // The admin archives it from its row; it leaves the list for Archived at once.
  await page.goto('/settings/docs');
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toContainText('1 page');
  await row.hover();
  await row.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Archive' }).click();
  await expect(page.getByText(`${name} archived`)).toBeVisible();
  await expect(row).toHaveCount(0);
  await page.getByRole('radio', { name: /^Archived/ }).click();
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();

  // The member's picker no longer offers it.
  const again = await openNewPage(sam, key);
  await expect(again.getByRole('button', { name: /^RFC/ })).toBeVisible();
  await expect(again.getByRole('button', { name: new RegExp(name) })).toHaveCount(0);

  // And the member cannot reach Settings › Docs' list.
  const refused = await sam.request.get('/api/v1/docs/org-templates');
  expect(refused.status()).toBe(403);
});

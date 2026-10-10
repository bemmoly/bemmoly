import { expect, test } from '@playwright/test';
import { useMockBackend } from './support/mock-backend.ts';

test('⌘K finds a settings page with the keyboard and opens it', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /, Rohan$/ })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  await palette.getByRole('combobox').fill('storage');
  await expect(palette.getByRole('option', { name: /Storage and backups/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/settings\/backups$/);
});

test('⌘K finds people, and a request shows the plan preview', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /, Rohan$/ })).toBeVisible();
  await page.keyboard.press('/');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await palette.getByRole('combobox').fill('aisha');
  await expect(palette.getByRole('option', { name: /Aisha K\./ })).toBeVisible();

  await palette.getByRole('combobox').fill('move everything blocked by PLT-204 to next sprint');
  await expect(palette.getByRole('button', { name: /Run 3 changes/ })).toBeVisible();
  await expect(palette.getByText(/Preview only/)).toBeVisible();
});

test('Create explains why it is empty and leads an admin to Modules', async ({ page }) => {
  const backend = await useMockBackend(page, 'ready');
  // The seeded workspace has Work and Docs on; with both off, no module offers anything to create.
  for (const id of ['work', 'docs']) {
    backend.api.dispatch('POST', `http://127.0.0.1/api/v1/admin/modules/${id}/disable`, {});
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'Create' }).click();
  const menu = page.getByRole('menu', { name: 'Create' });
  await expect(menu.getByText('Nothing to create yet')).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Open Settings › Modules' }).click();
  await expect(page).toHaveURL(/\/settings\/modules$/);
});

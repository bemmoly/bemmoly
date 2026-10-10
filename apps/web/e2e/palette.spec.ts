import { expect, test } from '@playwright/test';
import { useMockBackend } from './support/mock-backend.ts';

test('⌘K finds a settings page with the keyboard and opens it', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /, Rohan$/ })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  await expect(palette.getByRole('combobox')).toHaveAttribute(
    'placeholder',
    'Search or run a command…',
  );
  await palette.getByRole('combobox').fill('storage');
  await expect(palette.getByRole('option', { name: /Storage and backups/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/settings\/backups$/);
});

test('empty, ⌘K offers what you opened, what this screen can do, then places', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/work/issue/PLT-204');
  await expect(
    page.getByRole('heading', { name: 'Session store migration to Postgres' }),
  ).toBeVisible();
  await page.goto('/work/issue/PLT-226');
  await expect(page.getByRole('heading', { name: /Refresh token reused/ })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  const recent = palette.getByRole('group', { name: 'Recent' });
  await expect(recent.getByRole('option').first()).toContainText('PLT-226');
  await expect(recent.getByRole('option').nth(1)).toContainText('PLT-204');
  const actions = palette.getByRole('group', { name: 'Actions' });
  await expect(actions.getByRole('option', { name: /Assign PLT-226 to me/ })).toBeVisible();
  await expect(actions.getByRole('option', { name: /New issue/ })).toContainText('C');
  await expect(palette.getByRole('group', { name: 'Navigation' })).toBeAttached();

  // Tab filters by type.
  await page.keyboard.press('Tab');
  await expect(palette.getByRole('button', { name: 'Issues' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.keyboard.press('Shift+Tab');
  await palette.getByRole('combobox').fill('');
  await actions.getByRole('option', { name: /Assign PLT-226 to me/ }).click();
  await expect(page.getByText('PLT-226 is yours')).toBeVisible();
});

test('without AI the palette never offers a plan', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /, Rohan$/ })).toBeVisible();
  await page.keyboard.press('/');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await palette.getByRole('combobox').fill('aisha');
  await expect(palette.getByRole('option', { name: /Aisha K\./ })).toBeVisible();
  await palette.getByRole('combobox').fill('move everything blocked by PLT-204 to next sprint');
  await expect(palette.getByRole('button', { name: /Run 3 changes/ })).toHaveCount(0);
});

test('? lists every shortcut, grouped', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/inbox');
  await expect(page.getByRole('listbox', { name: 'Notifications' })).toBeVisible();
  await page.keyboard.press('?');
  const overlay = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  for (const group of ['Everywhere', 'Go to', 'Lists and dialogs', 'Inbox']) {
    await expect(overlay.getByRole('region', { name: group })).toBeVisible();
  }
  await expect(overlay.getByRole('region', { name: 'Go to' })).toContainText('Board');
});

test('New explains why it is empty and leads an admin to Modules', async ({ page }) => {
  const backend = await useMockBackend(page, 'ready');
  // The seeded workspace has Work and Docs on; with both off, no module offers anything to create.
  for (const id of ['work', 'docs']) {
    backend.api.dispatch('POST', `http://127.0.0.1/api/v1/admin/modules/${id}/disable`, {});
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByText('Nothing to create yet')).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Open Settings › Modules' }).click();
  await expect(page).toHaveURL(/\/settings\/modules$/);
});

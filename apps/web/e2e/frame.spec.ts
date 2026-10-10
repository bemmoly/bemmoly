import { expect, test, type Page } from '@playwright/test';
import { useMockBackend } from './support/mock-backend.ts';

const sidebarOf = (page: Page) => page.getByRole('complementary', { name: 'Sidebar' });

test('the sidebar moves between Home, Inbox, a project and its views', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/');
  const sidebar = sidebarOf(page);
  await sidebar.getByRole('link', { name: /^Inbox/ }).click();
  // The item on show is kept in the address, so a refresh or a new arrival keeps it.
  await expect(page).toHaveURL(/\/inbox(\?item=[\w-]+)?$/);
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Inbox');

  await sidebar.getByRole('link', { name: 'Platform Core' }).click();
  await expect(page).toHaveURL(/\/work\/board\/PLT$/);
  await expect(sidebar.getByRole('link', { name: 'Board' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await sidebar.getByRole('link', { name: 'Backlog' }).click();
  await expect(page).toHaveURL(/\/work\/backlog\/PLT$/);
  await expect(
    page.getByRole('navigation', { name: 'Views' }).getByRole('link', { name: 'Backlog' }),
  ).toHaveAttribute('aria-current', 'page');

  // The G chords go to the same places, and never while typing.
  await page.keyboard.press('g');
  await page.keyboard.press('h');
  await expect(page).toHaveURL(/\/$/);
});

test('[ folds the sidebar to the rail, and it stays folded for this person', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/');
  await expect(page.locator('[data-sidebar="full"]')).toBeVisible();
  await page.keyboard.press('[');
  await expect(page.locator('[data-sidebar="rail"]')).toBeVisible();
  await expect(sidebarOf(page).getByRole('link', { name: 'Home', exact: true })).toHaveText('');
  await page.reload();
  await expect(page.locator('[data-sidebar="rail"]')).toBeVisible();
  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await expect(page.locator('[data-sidebar="full"]')).toBeVisible();
});

test('settings show in the same sidebar, and Escape goes back to the app', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/work/board/PLT');
  await page.getByTestId('nav-settings').click();
  const settings = page.getByRole('navigation', { name: 'Settings' });
  await expect(settings.getByRole('link', { name: 'Teams' })).toBeVisible();
  await settings.getByRole('link', { name: 'Teams' }).click();
  await expect(page).toHaveURL(/\/settings\/teams$/);
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('People');
  await expect(page).toHaveTitle('Teams · Settings · Bemmoly');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/work\/board\/PLT$/);
});

test('a new issue opens over the page you are on, and Close leaves you there', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/work/board/PLT');
  await expect(page.getByRole('heading', { name: /Sprint/ })).toBeVisible();
  await page.keyboard.press('c');
  await expect(page).toHaveURL(/\/work\/board\/PLT\?create=work\.create-issue$/);
  const dialog = page.getByRole('dialog', { name: 'Create issue' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/work\/board\/PLT$/);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the sidebar is a sheet, a bottom bar appears and nothing scrolls sideways', async ({
    page,
  }) => {
    await useMockBackend(page, 'ready');
    for (const path of ['/', '/inbox', '/work/board/PLT', '/settings/teams']) {
      await page.goto(path);
      await expect(page.getByRole('navigation', { name: 'Quick navigation' })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, path).toBe(false);
    }
    await expect(page.getByRole('complementary', { name: 'Sidebar' })).toHaveCount(0);
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const sheet = page.getByRole('dialog', { name: 'Menu' });
    await sheet.getByRole('link', { name: /^Inbox/ }).click();
    // The item on show is kept in the address, so a refresh or a new arrival keeps it.
    await expect(page).toHaveURL(/\/inbox(\?item=[\w-]+)?$/);
    await expect(sheet).toBeHidden();
  });
});

import { expect, test } from '@playwright/test';
import { useMockBackend } from './support/mock-backend.ts';

test('the shell boots after the session and lazy-loads a module chunk', async ({ page }) => {
  await useMockBackend(page, 'ready');
  const modules = page.waitForResponse((response) => response.url().endsWith('/api/v1/modules'));
  await page.goto('/');
  expect((await modules).status()).toBe(200);

  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
  await expect(sidebar.getByRole('img', { name: 'Bemmoly' }).first()).toBeAttached();
  await expect(sidebar.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: /, Rohan$/ })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/);
  await expect(page).toHaveTitle('Home · Acme Labs · Bemmoly');

  await sidebar.getByRole('link', { name: 'Sample' }).click();
  await expect(page).toHaveURL(/\/sample$/);
  await expect(page.locator('[data-module="sample"]')).toBeVisible();
});

test('the boot frame paints the mark before the app runs and leaves once a page renders', async ({
  page,
}) => {
  await useMockBackend(page, 'ready');
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/assets\/mount-[\w-]+\.js$/, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });

  const boot = page.locator('#boot');
  await expect(boot.locator('svg')).toBeVisible();
  // The designed blue, from the brand file, not black: the CSP must not have dropped it.
  await expect(boot.locator('.brand-mark-bg').first()).toHaveCSS('fill', hexToRgb('#2356C9'));

  release();
  await expect(page.getByRole('heading', { name: /, Rohan$/ })).toBeVisible();
  await expect(boot).toHaveCount(0);
});

function hexToRgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

test('a deep link to a module route loads the shell', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/sample');
  await expect(page.locator('[data-module="sample"]')).toBeVisible();
});

test('an unknown address shows the not-found page inside the frame', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/nowhere/at/all');
  await expect(
    page.getByRole('heading', { name: 'There is nothing at this address' }),
  ).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Sidebar' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
});

test('the web app manifest and icons come from the brand files', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.icons.map((icon: { src: string }) => icon.src)).toContain('/brand/icon-192.png');
  expect((await request.get('/brand/icon-192.png')).status()).toBe(200);
  expect((await request.get('/brand/favicon.svg')).status()).toBe(200);
});

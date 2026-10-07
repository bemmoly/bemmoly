import { expect, test } from '@playwright/test';
import { useMockBackend } from './support/mock-backend.ts';

test('the shell boots after the session and lazy-loads a module chunk', async ({ page }) => {
  await useMockBackend(page, 'ready');
  const modules = page.waitForResponse((response) => response.url().endsWith('/api/v1/modules'));
  await page.goto('/');
  expect((await modules).status()).toBe(200);

  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'Bemmoly home' })).toBeVisible();
  const nav = header.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: /Your work/ })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { name: /, Rohan$/ })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/);

  await nav.getByRole('link', { name: /Sample/ }).click();
  await expect(page).toHaveURL(/\/sample$/);
  await expect(page.locator('[data-module="sample"]')).toBeVisible();
});

test('a deep link to a module route loads the shell', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/sample');
  await expect(page.locator('[data-module="sample"]')).toBeVisible();
});

test('an unknown address shows the not-found page inside the shell', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/nowhere/at/all');
  await expect(
    page.getByRole('heading', { name: 'There is nothing at this address' }),
  ).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
});

test('the web app manifest and icons come from the brand files', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.icons.map((icon: { src: string }) => icon.src)).toContain('/brand/icon-192.png');
  expect((await request.get('/brand/icon-192.png')).status()).toBe(200);
  expect((await request.get('/brand/favicon.svg')).status()).toBe(200);
});

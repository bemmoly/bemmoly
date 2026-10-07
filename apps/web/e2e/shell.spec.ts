import { expect, test } from '@playwright/test';

test('the shell boots from the module list and lazy-loads a module chunk', async ({ page }) => {
  const modules = page.waitForResponse((response) => response.url().endsWith('/api/v1/modules'));
  await page.goto('/');
  expect((await modules).status()).toBe(200);

  const header = page.getByRole('banner');
  await expect(header.getByText('Bemmoly', { exact: true })).toBeVisible();
  const sample = page
    .getByRole('navigation', { name: 'Modules' })
    .getByRole('link', { name: 'Sample' });
  await expect(sample).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/);

  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(['rgb(244, 245, 247)', 'rgb(15, 18, 23)']).toContain(background);

  await sample.click();
  await expect(page).toHaveURL(/\/sample$/);
  await expect(page.getByRole('heading', { name: 'Sample' })).toBeVisible();
  await expect(page.getByText('Module sample 0.0.0 is enabled.')).toBeVisible();
});

test('a deep link to a module route loads the shell', async ({ page }) => {
  await page.goto('/sample');
  await expect(page.locator('[data-module="sample"]')).toBeVisible();
});

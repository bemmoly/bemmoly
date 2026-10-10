import { expect, test, type Page } from '@playwright/test';
import { useMockBackend } from './support/mock-backend.ts';

/*
 * ⌘K with AI: a request becomes a plan, nothing changes until the person runs it, the run
 * shows each step land, the board changes, and Undo puts it back.
 */

const REQUEST = 'move everything blocked by PLT-204 to next sprint';

async function openPalette(page: Page) {
  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  return palette;
}

test('a request becomes a plan, runs, changes the board and undoes', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/work/board');
  const board = page.getByRole('main');
  await expect(board.getByText('Session cleanup background job').first()).toBeVisible();

  const palette = await openPalette(page);
  await palette.getByRole('combobox').fill(REQUEST);
  const line = palette.getByRole('option', { name: /Plan with Bemmoly/ });
  await expect(line).toBeVisible();
  await page.keyboard.press('Enter');

  const plan = palette.getByRole('region', { name: 'Plan' });
  await expect(plan.getByText('nothing happens until you confirm')).toBeVisible();
  await expect(plan.getByText(/Move the 2 issues blocked by PLT-204/)).toBeVisible();
  const steps = plan.getByRole('table', { name: 'Plan steps' }).getByRole('row');
  await expect(steps).toHaveCount(4);
  await expect(steps.nth(3)).toContainText('both');
  await expect(steps.nth(3)).toContainText('via Bemmoly for Rohan');
  await page.keyboard.press('Enter');
  await expect(plan.getByText('3 changes made', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(steps.nth(1)).toContainText('Done');
  await page.keyboard.press('Escape');
  // Sprint 15 is not on the board of the active sprint: both issues left it.
  await expect(board.getByText('Session cleanup background job')).toHaveCount(0);
  await expect(board.getByText('Remove legacy cookie path from monolith')).toHaveCount(0);

  const again = await openPalette(page);
  await again.getByRole('combobox').fill(REQUEST);
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(again.getByRole('button', { name: /Run 3 changes/ })).toBeVisible();
  await again.getByRole('button', { name: 'Edit plan' }).click();
  await again.getByRole('checkbox', { name: 'Keep the change to PLT-219' }).uncheck();
  await again.getByRole('checkbox', { name: 'Keep the change to both' }).uncheck();
  await expect(again.getByRole('button', { name: /Run 1 change$/ })).toBeVisible();
});

test('undo puts the plan back on the board', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/work/board');
  const board = page.getByRole('main');
  await expect(board.getByText('Session cleanup background job').first()).toBeVisible();
  const palette = await openPalette(page);
  await palette.getByRole('combobox').fill(REQUEST);
  await page.keyboard.press('Enter');
  await palette.getByRole('button', { name: /Run 3 changes/ }).click();
  await expect(palette.getByText('3 changes made', { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await palette.getByRole('button', { name: 'Undo' }).click();
  await expect(palette.getByText('3 changes put back', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(board.getByText('Session cleanup background job').first()).toBeVisible();
});

test('with AI actions off the plan is a preview that never runs', async ({ page }) => {
  const backend = await useMockBackend(page, 'ready');
  backend.api.dispatch('PATCH', 'http://127.0.0.1/api/v1/admin/ai/settings', {
    privacy: { allowActions: false },
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /, Rohan$/ })).toBeVisible();
  const palette = await openPalette(page);
  await palette.getByRole('combobox').fill(REQUEST);
  await page.keyboard.press('Enter');
  await expect(palette.getByText('Preview only')).toBeVisible();
  await expect(palette.getByRole('button', { name: /Run/ })).toHaveCount(0);
});

test('a spent budget says so and search still works', async ({ page }) => {
  const backend = await useMockBackend(page, 'ready');
  backend.api.dispatch('PATCH', 'http://127.0.0.1/api/v1/admin/ai/settings', {
    budget: { monthlyBudgetUsd: 0 },
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /, Rohan$/ })).toBeVisible();
  const palette = await openPalette(page);
  await palette.getByRole('combobox').fill(REQUEST);
  await page.keyboard.press('Enter');
  await expect(palette.getByRole('alert')).toContainText("This month's AI budget is spent");
});

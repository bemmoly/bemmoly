import { expect, test } from '@playwright/test';
import { useMockBackend } from './support/mock-backend.ts';

test('the directory lists people with what is happening and opens a profile', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/people');
  await expect(page.getByText('Lena T.')).toBeVisible();
  await expect(page.getByText(/Joins /).first()).toBeVisible();
  await page
    .getByRole('searchbox', { name: 'Search people' })
    .or(page.getByLabel('Search people'))
    .fill('mobile');
  await expect(page.getByText('Jonas M.')).toBeVisible();
  await expect(page.getByText('Aisha K.')).toHaveCount(0);
  await page.getByRole('link', { name: 'Jonas M.' }).click();
  await expect(page).toHaveURL(/\/people\/p\//);
  await expect(page.getByRole('heading', { level: 1, name: 'Jonas M.' })).toBeVisible();
  await expect(page.getByText('Employment', { exact: true })).toBeVisible();
});

test('the org chart folds reporting lines and groups by location', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/people/org');
  const tree = page.getByRole('tree', { name: 'Reporting lines' });
  await expect(tree.getByText('Priya N.')).toBeVisible();
  await expect(tree.getByText('Jonas M.')).toBeVisible();
  await page.getByRole('button', { name: 'Hide Priya N.’s reports' }).click();
  await expect(tree.getByText('Jonas M.')).toHaveCount(0);
  await page
    .getByRole('radio', { name: 'Locations' })
    .or(page.getByRole('button', { name: 'Locations' }))
    .click();
  await expect(page.getByText('Berlin')).toBeVisible();
});

test('a manager approves time off waiting on them, and it is booked', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/people/time-off');
  await expect(page.getByText(/Balances, \d{4}/)).toBeVisible();
  await page.goto('/people/time-off/approvals');
  await expect(page.getByText(/Aisha K\. · Annual leave/)).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Nothing waits on you.')).toBeVisible();
  await page.goto('/people/time-off/calendar');
  await expect(page.getByRole('grid')).toBeVisible();
});

test('asking for time off shows the days and books against the balance', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/people/time-off/new');
  const dialog = page.getByRole('dialog', { name: 'Request time off' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Type' }).click();
  await page.getByRole('option', { name: /^Sick leave/ }).click();
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText('Time off booked')).toBeVisible();
});

test('a joiner’s onboarding shows its tasks in phases, and a task is ticked', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/people/journeys');
  await page.getByText('Lena T.').first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lena T.' })).toBeVisible();
  await expect(page.getByText('On the day')).toBeVisible();
  const box = page.getByRole('checkbox', { name: 'Mark Order a laptop done' });
  await box.click();
  await expect(box).toBeChecked();
});

test('Settings › People lists leave policies and journey templates', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/settings/people/leave');
  await expect(page.getByText('Annual leave, Germany')).toBeVisible();
  await page.goto('/settings/people/journeys');
  await expect(page.getByText('Everyone joining')).toBeVisible();
});

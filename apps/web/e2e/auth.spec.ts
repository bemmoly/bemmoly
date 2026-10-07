import { expect, test } from '@playwright/test';
import { INVITE_TOKEN, MOCK_PASSWORD, RESET_TOKEN } from '../src/mocks/db.ts';
import { useMockBackend } from './support/mock-backend.ts';

test('a stranger is sent to sign in, then back to where they were going', async ({ page }) => {
  await useMockBackend(page, 'signed-out');
  await page.goto('/settings/notifications');
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await expect(page.getByText('Your work. Your platform.')).toBeVisible();

  await page.getByLabel('Email').fill('rohan@acmelabs.dev');
  await page.getByLabel('Password').fill('not the password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect');

  await page.getByLabel('Password').fill(MOCK_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/settings\/notifications$/);
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
});

test('the login form checks fields before sending', async ({ page }) => {
  await useMockBackend(page, 'signed-out');
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter your password')).toBeVisible();
});

test('a password reset link from the email sets a new password', async ({ page }) => {
  const backend = await useMockBackend(page, 'signed-out');
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill('rohan@acmelabs.dev');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText(/a reset link is on its way/)).toBeVisible();

  await page.goto(`/reset-password#token=${RESET_TOKEN}`);
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel('New password', { exact: true }).fill('a much longer password');
  await page.getByLabel('Type it again').fill('a much longer password');
  await page.getByRole('button', { name: 'Save password and sign in' }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(backend.api.db.passwords['rohan@acmelabs.dev']).toBe('a much longer password');
});

test('an invitation link creates the account and signs the person in', async ({ page }) => {
  await useMockBackend(page, 'signed-out');
  await page.goto(`/accept-invitation#token=${INVITE_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Join Acme Labs' })).toBeVisible();
  await page.getByLabel('Your name').fill('Sam R.');
  await page.getByLabel('Password', { exact: true }).fill('sams own password');
  await page.getByLabel('Type it again').fill('sams own password');
  await page.getByRole('button', { name: 'Create account and join' }).click();
  await expect(page.getByRole('heading', { name: /, Sam$/ })).toBeVisible();
});

test('signing out returns to the login page', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/');
  await page.getByRole('button', { name: /Account: Rohan S\./ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
});

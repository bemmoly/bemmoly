import { expect, test } from '@playwright/test';
import { INVITE_TOKEN, MOCK_PASSWORD, RESET_TOKEN } from '../src/mocks/db.ts';
import { useMockBackend } from './support/mock-backend.ts';

test('a stranger is sent to sign in, then back to where they were going', async ({ page }) => {
  await useMockBackend(page, 'signed-out');
  await page.goto('/settings/notifications');
  await expect(page).toHaveURL(/\/login\?redirect=/);
  // No logo in this workspace: the Bemmoly lockup leads and the heading offers to go back.
  await expect(page.getByRole('banner').getByRole('img', { name: 'Bemmoly' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in again' })).toBeVisible();
  await expect(page).toHaveTitle(/Sign in.*Acme Labs/);

  const submit = page.getByRole('button', { name: /^Sign in and go back/ });
  await page.getByLabel('Email').fill('rohan@acmelabs.dev');
  await page.getByLabel('Password', { exact: true }).fill('not the password');
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('That email and password don’t match');

  await page.getByLabel('Password', { exact: true }).fill(MOCK_PASSWORD);
  await submit.click();
  await expect(page).toHaveURL(/\/settings\/notifications$/);
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
});

test('the login form checks fields before sending', async ({ page }) => {
  await useMockBackend(page, 'signed-out');
  await page.goto('/login');
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await expect(page.getByText('Enter your password')).toBeVisible();
});

test('a password reset link from the email sets a new password', async ({ page }) => {
  const backend = await useMockBackend(page, 'signed-out');
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill('rohan@acmelabs.dev');
  await page.getByRole('button', { name: /^Email me a link/ }).click();
  await expect(page.getByText(/a link to choose a new one is on its way/)).toBeVisible();

  await page.goto(`/reset-password#token=${RESET_TOKEN}`);
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel('New password', { exact: true }).fill('a much longer password');
  await page.getByRole('button', { name: /^Save password and sign in/ }).click();
  // Saving signs the person in and opens the workspace.
  await expect(page).toHaveURL(/:\d+\/$/);
  expect(backend.api.db.passwords['rohan@acmelabs.dev']).toBe('a much longer password');
});

test('an invitation link creates the account and signs the person in', async ({ page }) => {
  await useMockBackend(page, 'signed-out');
  await page.goto(`/accept-invitation#token=${INVITE_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Join Acme Labs' })).toBeVisible();
  await page.getByLabel('Your name').fill('Sam R.');
  await page.getByLabel('Password', { exact: true }).fill('sams own password');
  await page.getByRole('button', { name: /^Join Acme Labs/ }).click();
  await expect(page.getByRole('heading', { name: /, Sam$/ })).toBeVisible();
});

test('signing out returns to the login page', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/');
  await page.getByRole('button', { name: /Account: Rohan S\./ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
});

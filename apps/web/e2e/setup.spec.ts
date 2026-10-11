import { expect, test } from '@playwright/test';
import { useMockBackend } from './support/mock-backend.ts';

test('a fresh install walks from the welcome to the launchpad', async ({ page }) => {
  await useMockBackend(page, 'fresh');
  await page.goto('/setup');
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Bemmoly' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Server health' })).toBeVisible();

  // Enter in a field advances; a blank name stays on the step and says why.
  await page.getByLabel('Workspace name').press('Enter');
  await expect(page.getByLabel('Workspace name')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Workspace name').fill('Acme Labs');
  await page.getByLabel('Workspace name').press('Enter');

  await expect(page.getByRole('heading', { level: 1, name: 'Create your account' })).toBeVisible();
  await page.getByLabel('Your name').fill('Rohan S.');
  await page.getByLabel('Email').fill('rohan@acme.test');
  await page.getByLabel('Password', { exact: true }).fill('a long enough password');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Bring your data, or start clean' }),
  ).toBeVisible();
  // The AI step names its skip as the choice it is: no AI.
  const steps = [
    { skip: 'Skip for now', next: 'Invite your team' },
    { skip: 'Skip for now', next: 'AI, on your terms' },
    { skip: 'Skip, no AI', next: 'Make it yours' },
  ];
  for (const { skip, next } of steps) {
    await page.getByRole('button', { name: skip }).click();
    await expect(page.getByRole('heading', { level: 1, name: next })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'AI, on your terms' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip, no AI' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'You are all set' })).toBeVisible();
  await expect(page.getByLabel('Setup summary')).toBeVisible();
  await page.getByRole('button', { name: 'Open Bemmoly' }).click();
  await expect(page).toHaveURL(/\/$/);

  // A fresh install has no modules on; Home offers the one step that fixes that.
  await expect(page.getByText('Issues and docs come from modules')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Choose in Settings › Modules' })).toBeVisible();
  await page.getByRole('button', { name: 'Turn on Work and Docs' }).click();
  await expect(
    page.getByText('Work and Docs are on. Only admins can open them until you grant access.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Turn on Work and Docs' })).toBeHidden();
});

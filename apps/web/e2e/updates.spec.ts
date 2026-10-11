import { expect, test, type Page } from '@playwright/test';
import { useMockBackend } from './support/mock-backend.ts';

/*
 * The Update dialog (Settings › Updates): the six steps with live status from the server, the
 * app restarting in the middle, the page reloading onto the new version, every admin seeing
 * the running update, and no second update while one runs.
 */

const steps = (page: Page) =>
  page.getByRole('list', { name: 'Update steps' }).getByRole('listitem');

async function openUpdates(page: Page) {
  await page.goto('/settings/updates');
  await expect(page).toHaveTitle(/^Updates · Settings/, { timeout: 10_000 });
}

test('follows an update step by step, across the restart, onto the new version', async ({
  page,
}) => {
  const { api } = await useMockBackend(page);
  const readyz: number[] = [];
  page.on('response', (response) => {
    if (response.url().endsWith('/readyz')) readyz.push(response.status());
  });
  await openUpdates(page);
  await page.getByRole('button', { name: 'Update to 0.1.2' }).click();
  const confirm = page.getByRole('dialog', { name: 'Update to 0.1.2?' });
  await confirm.getByRole('button', { name: 'Update to 0.1.2' }).click();

  const dialog = page.getByRole('dialog', { name: 'Updating to 0.1.2' });
  await expect(dialog).toBeVisible();
  await expect(steps(page)).toHaveCount(6);
  await expect(steps(page).first()).toContainText('Back up the database and files');
  // Steps finish in order while the server reports them.
  await expect(steps(page).nth(2)).toContainText('Done', { timeout: 10_000 });
  await expect(page.getByText(/Bemmoly is restarting/)).toBeVisible({ timeout: 10_000 });

  // The new version answers: the page reloads itself and reopens on the remaining step.
  await page.waitForEvent('load', { timeout: 15_000 });
  expect(readyz).toContain(200);
  await expect(page.getByRole('dialog', { name: /Updat(ing|ed) to 0\.1\.2/ })).toBeVisible();
  const done = page.getByRole('dialog', { name: 'Updated to 0.1.2' });
  await expect(done).toBeVisible({ timeout: 10_000 });
  await expect(steps(page).filter({ hasText: 'Done' })).toHaveCount(6);
  await expect(done.getByText('Bemmoly 0.1.2 is running.', { exact: false })).toBeVisible();
  expect(api.db.updates.current.version).toBe('0.1.2');
  await done.getByRole('button', { name: 'Done' }).click();
  await expect(done).toBeHidden();
  await expect(page.getByText('Running', { exact: false }).first()).toBeVisible();
});

test('every admin sees the running update, and a second one is refused', async ({ page }) => {
  const { api } = await useMockBackend(page);
  // Another admin started it before this page opened.
  expect(api.dispatch('POST', '/api/v1/admin/updates/apply', { version: '0.1.2' })?.status).toBe(
    202,
  );
  await openUpdates(page);
  const dialog = page.getByRole('dialog', { name: 'Updating to 0.1.2' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('The update keeps running if you close this.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
  // Closed, it stays closed; the page says what runs and offers the progress again.
  await expect(page.getByRole('button', { name: 'Update to 0.1.2' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Show progress' })).toBeVisible();
  // The server refuses a second update whatever the page shows.
  const second = api.dispatch('POST', '/api/v1/admin/updates/apply', { version: '0.1.2' });
  expect(second?.status).toBe(409);
  expect(JSON.stringify(second?.body)).toContain('already running');
  await page.getByRole('button', { name: 'Show progress' }).click();
  await expect(page.getByRole('dialog', { name: /Updat(ing|ed) to 0\.1\.2/ })).toBeVisible();
});

test('a refused signature ends the update in plain words, with nothing lost', async ({ page }) => {
  const { api } = await useMockBackend(page);
  api.db.updateJob = {
    from: '0.1.1',
    target: '0.1.2',
    startedAt: new Date().toISOString(),
    phase: Number.MAX_SAFE_INTEGER,
    fail: 'verify',
    keepUpdater: false,
  };
  await openUpdates(page);
  await page.getByRole('button', { name: 'Update to 0.1.2' }).click();
  await page
    .getByRole('dialog', { name: 'Update to 0.1.2?' })
    .getByRole('button', { name: 'Update to 0.1.2' })
    .click();
  const failed = page.getByRole('dialog', { name: 'The update did not finish' });
  await expect(failed).toBeVisible({ timeout: 10_000 });
  await expect(failed.getByRole('alert')).toContainText('0.1.1 kept running and nothing was lost');
  await expect(failed.getByText(/Signature verification failed/)).toBeVisible();
  await expect(steps(page).nth(2)).toContainText('Failed');
  await expect(steps(page).nth(3)).toContainText('Not started');
});

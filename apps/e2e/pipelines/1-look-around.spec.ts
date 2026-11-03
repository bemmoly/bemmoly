import { expect, test } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';

/*
 * Walkthrough step 1: the seeded Acme on Runs; For you and Services are 24-services. Every
 * screen loads with the seed's data, never an error.
 */

test('Runs lists Acme’s runs, filters to failures and opens one', async ({ browser }) => {
  const page = await openPipelines(browser, '/runs');
  await expect(page.getByRole('heading', { name: 'Runs' })).toBeVisible();
  await expectLoaded(page);
  await page.getByRole('radio', { name: 'Failed' }).click();
  await expect(page).toHaveURL(/failed/);
  const first = page.getByRole('row', { name: /Run \d+ · / }).first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/pipelines\/runs\/[0-9a-f-]+/);
  await expectLoaded(page);
});

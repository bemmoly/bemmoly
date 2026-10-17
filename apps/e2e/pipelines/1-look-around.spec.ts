import { expect, test } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';

/*
 * Walkthrough step 1: the seeded Acme on For you, the Map (live, then rewound), the Catalog,
 * an application and Runs. Every screen loads with the seed's data, never an error.
 */

test('For you greets the person and shows their changes and Acme today', async ({ browser }) => {
  const page = await openPipelines(browser, '/');
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening), / }),
  ).toBeVisible();
  await expect(page.getByText(/today$/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your changes' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'In flight' })).toBeVisible();
  await expectLoaded(page);
});

test('the Map shows Acme live, rewinds and comes back to live', async ({ browser }) => {
  const page = await openPipelines(browser, '/map');
  await expect(page.getByRole('heading', { name: 'Release map' })).toBeVisible();
  await expect(page.getByRole('table', { name: /^Release map of / })).toBeVisible();
  await expectLoaded(page);
  await page.getByRole('button', { name: 'Rewind the map 15 minutes' }).click();
  await expect(page.getByText(/as it was at /)).toBeVisible();
  await expect(page).toHaveURL(/[?&]at=/);
  await page.getByRole('button', { name: 'Back to live' }).click();
  await expect(page.getByText(/as it was at /)).toHaveCount(0);
  await expectLoaded(page);
});

test('the Catalog lists, filters and opens an application', async ({ browser }) => {
  const page = await openPipelines(browser, '/catalog');
  await expect(page.getByText(/^\d+ of \d+ applications$/)).toBeVisible();
  await expectLoaded(page);
  await page.keyboard.press('/');
  await page.keyboard.type('checkout-api');
  await expect(page.getByText(/^1 of \d+ applications$/)).toBeVisible();
  await page.getByRole('row', { name: /^checkout-api / }).click();
  await expect(page).toHaveURL(/\/pipelines\/applications\/checkout-api/);
  await expect(page.getByRole('heading', { name: 'checkout-api' })).toBeVisible();
  await expect(page.getByText('Recent runs')).toBeVisible();
  await expectLoaded(page);
});

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

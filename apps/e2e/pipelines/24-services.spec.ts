import { expect, test } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';

/*
 * Services and For you on the seeded install: For you greets the person with their stats,
 * what needs them, what runs and their services; Services lists every service by domain and
 * by team, filters, and opens a service whose tabs each load: the environment lane, its
 * versions and where they run, its runs, its settings per environment and its logs.
 */

test('For you shows the day: stats, what needs you, what runs and your services', async ({
  browser,
}, info) => {
  const page = await openPipelines(browser, '/');
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening), / }),
  ).toBeVisible();
  await expect(page.getByText('Deploys this week')).toBeVisible();
  await expect(page.getByText('Services failing now')).toBeVisible();
  for (const name of ['Needs you', 'Running now', 'Your services'])
    await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Promote a version' })).toBeVisible();
  await expectLoaded(page);
  await page.screenshot({ path: info.outputPath('for-you-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('for-you-dark.png'), fullPage: true });
});

test('Services lists every service by domain, filters and opens one', async ({ browser }, info) => {
  const page = await openPipelines(browser, '/services');
  await expect(page.getByRole('heading', { name: 'Services', level: 1 })).toBeVisible();
  await expect(page.getByText(/^\d[\d,]* services in \d+ domains?$/)).toBeVisible();
  await expect(page.getByRole('table').first()).toBeVisible();
  await expectLoaded(page);
  await page.screenshot({ path: info.outputPath('services-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('services-dark.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' });

  await page.getByRole('radio', { name: 'By team' }).click();
  await expect(page).toHaveURL(/[?&]by=team/);
  await expect(page.getByRole('table').first()).toBeVisible();

  await page.keyboard.press('/');
  await page.keyboard.type('checkout-api');
  await expect(page).toHaveURL(/[?&]q=checkout-api/);
  const row = page.getByRole('row', { name: /checkout-api/ }).first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(/\/pipelines\/services\/checkout-api$/);
  await expect(page.getByRole('heading', { name: 'checkout-api', level: 1 })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Environments, in promotion order' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deploy or promote' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent runs' })).toBeVisible();
  await expectLoaded(page);
  await page.screenshot({ path: info.outputPath('service-overview-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('service-overview-dark.png'), fullPage: true });
});

test("a service's tabs: versions, runs, settings and logs", async ({ browser }, info) => {
  const page = await openPipelines(browser, '/services/checkout-api/versions');
  await expect(
    page.getByText('Every build that passes its tests becomes a version', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('table', { name: 'Versions' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Promote|Redeploy)$/ }).first()).toBeVisible();
  await expectLoaded(page);
  await page.screenshot({ path: info.outputPath('service-versions-light.png'), fullPage: true });
  const tabs = page.getByRole('navigation', { name: 'Service' });

  await tabs.getByRole('link', { name: 'Runs' }).click();
  await expect(page).toHaveURL(/\/services\/checkout-api\/runs$/);
  await expect(page.getByRole('table', { name: 'Runs' })).toBeVisible();
  await expectLoaded(page);

  await tabs.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/\/services\/checkout-api\/settings/);
  const unsaved = page.getByRole('complementary');
  await expect(unsaved.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible();
  await expect(unsaved.getByText('Nothing changed yet.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Port' }).fill('9090');
  await expect(unsaved.getByText('+ 9090')).toBeVisible();
  await expectLoaded(page);
  await page.screenshot({ path: info.outputPath('service-settings-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('service-settings-dark.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' });
  await unsaved.getByRole('button', { name: 'Discard' }).click();
  await expect(unsaved.getByText('Nothing changed yet.')).toBeVisible();

  await tabs.getByRole('link', { name: 'Logs' }).click();
  await expect(
    page.getByRole('heading', { name: /^Logs in |has no cloud project yet$/ }),
  ).toBeVisible();
  await expectLoaded(page);
});

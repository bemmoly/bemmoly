import { expect, test } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';
import { readState } from '../support/state.ts';

/*
 * Milestone three on screen: an application's Variables tab. A plain value for every
 * environment, a secret for Dev set and replaced but never shown again, Dev's own value over
 * the shared one, and a delete that brings the shared one back. The cloud simulator stands in
 * for Secret Manager, in the demo's Acme projects.
 */

const SECRET = 'e2e-secret-value-not-real';

test('set variables and a secret, and never see the secret again', async ({ browser }, info) => {
  const state = readState();
  const page = await openPipelines(browser, '/applications/checkout-api?tab=variables');
  const simulate = await page.request.put('/api/v1/admin/settings/pipelines.providers.simulate', {
    data: { value: true },
    headers: { origin: state.baseURL },
  });
  expect(simulate.ok()).toBe(true);
  const tab = page.getByRole('region', { name: 'Variables' });
  await expect(tab.getByRole('combobox', { name: 'Show variables for' })).toHaveText(
    /Every environment/,
  );

  // A plain value for every environment; the name is typed loosely and made a name.
  await tab.getByRole('button', { name: /Add variable/ }).click();
  const add = page.getByRole('dialog', { name: 'Add a variable' });
  await add.getByLabel('Name').fill('log level');
  await expect(add.getByLabel('Name')).toHaveValue('LOG_LEVEL');
  await add.getByLabel('Value').fill('info');
  await add.getByRole('button', { name: 'Save variable' }).click();
  await expect(add).toHaveCount(0);
  const every = tab.getByRole('table', { name: 'Variables for Every environment' });
  await expect(every.getByRole('row', { name: /LOG_LEVEL/ })).toContainText('info');

  // Dev shows it as coming from every environment.
  await tab.getByRole('combobox', { name: 'Show variables for' }).click();
  await page.getByRole('option', { name: 'Dev', exact: true }).click();
  await expect(page).toHaveURL(/env=dev/);
  const dev = tab.getByRole('table', { name: 'Variables for Dev' });
  await expect(dev.getByRole('row', { name: /LOG_LEVEL/ })).toContainText('From every environment');

  // A secret for Dev, from the N key: set, then answered with its version only.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('n');
  const secret = page.getByRole('dialog', { name: 'Add a variable' });
  await expect(secret).toContainText('For Dev only.');
  await secret.getByLabel('Name').fill('API_KEY');
  await secret.getByRole('radio', { name: 'Secret' }).click();
  await secret.getByLabel('Value').fill(SECRET);
  await secret.getByRole('button', { name: 'Save variable' }).click();
  await expect(page.getByText('API_KEY is version 1 in Secret Manager')).toBeVisible();
  const row = dev.getByRole('row', { name: /API_KEY/ });
  await expect(row).toContainText('Set, never shown');
  await expect(row).toContainText('v1');
  await expect(page.getByText(SECRET)).toHaveCount(0);

  // Replace it: version 2, still never shown.
  await row.getByRole('button', { name: 'Replace…' }).click();
  const replace = page.getByRole('dialog', { name: 'Replace the value of API_KEY' });
  await replace.getByLabel('Value').fill(`${SECRET}-2`);
  await replace.getByRole('button', { name: 'Replace value' }).click();
  await expect(row).toContainText('v2');
  const listed = await page.request.get('/api/v1/pipelines/applications/checkout-api/variables');
  expect(await listed.text()).not.toContain(SECRET);

  // Dev's own LOG_LEVEL over the shared one.
  await dev.getByRole('button', { name: 'Actions for LOG_LEVEL' }).click();
  await page.getByRole('menuitem', { name: 'Set a value for Dev' }).click();
  const override = page.getByRole('dialog', { name: 'Set LOG_LEVEL for Dev' });
  await expect(override.getByLabel('Value')).toHaveValue('info');
  await override.getByLabel('Value').fill('debug');
  await override.getByRole('button', { name: 'Save variable' }).click();
  const own = dev.getByRole('row', { name: /LOG_LEVEL/ });
  await expect(own).toContainText('debug');
  await expect(own).toContainText('Replaces the value for every environment');
  await expectLoaded(page);
  await page.screenshot({ path: info.outputPath('variables-dev-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('variables-dev-dark.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' });

  // Deleting Dev's own value brings the shared one back.
  await dev.getByRole('button', { name: 'Actions for LOG_LEVEL' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete LOG_LEVEL from Dev?' });
  await expect(confirm).toContainText('the value set for every environment');
  await confirm.getByRole('button', { name: 'Delete' }).click();
  await expect(confirm).toHaveCount(0);
  await expect(dev.getByRole('row', { name: /LOG_LEVEL/ })).toContainText('info');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('variables-dev-phone.png'), fullPage: true });
  await expectLoaded(page);
});

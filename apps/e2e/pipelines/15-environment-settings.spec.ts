import { expect, test } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';
import { readState } from '../support/state.ts';

/*
 * Per-environment settings on screen: an environment's runtime choice says what it costs and
 * who follows it; an application's Settings tab shows every value and where it came from, and
 * a value set there wins until it is cleared; a variable takes another application's address,
 * filled in per environment once that application is deployed there. The cloud simulator
 * stands in for Google Cloud.
 */

test('choose runtimes by cost, set deploy settings, and name another application', async ({
  browser,
}, info) => {
  const state = readState();
  const page = await openPipelines(browser, '/platform/environments');
  const simulate = await page.request.put('/api/v1/admin/settings/pipelines.providers.simulate', {
    data: { value: true },
    headers: { origin: state.baseURL },
  });
  expect(simulate.ok()).toBe(true);

  // The runtime choice says what each one costs, and who follows the default.
  await page.getByRole('button', { name: 'Actions for Prod · us-east1' }).click();
  await page.getByRole('menuitem', { name: 'Edit…' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit Prod · us-east1' });
  await expect(edit.getByTestId('runtime-cost')).toContainText('costs nothing while idle');
  await expect(edit.getByTestId('runtime-followers')).toContainText('follow this default');
  await edit.getByRole('combobox', { name: 'Applications run on' }).click();
  await page.getByRole('option', { name: /GKE Autopilot/ }).click();
  await expect(edit.getByTestId('runtime-cost')).toContainText('for as long as it runs');
  await page.screenshot({ path: info.outputPath('runtime-choice-light.png') });
  await edit.getByRole('button', { name: 'Cancel' }).click();
  await expect(edit).toHaveCount(0);

  // Every setting with its source; one set here wins, and clearing it brings the default back.
  await page.goto('/pipelines/applications/checkout-api?tab=settings');
  const tab = page.getByRole('region', { name: 'Deploy settings' });
  const staging = tab.getByRole('region', { name: 'Staging', exact: true });
  const table = staging.getByRole('table', { name: 'Deploy settings in Staging' });
  const min = table.getByRole('row', { name: /Minimum instances or pods/ });
  await expect(min).toContainText('0');
  await expect(min).toContainText('Default');
  await staging.getByRole('button', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings in Staging' });
  await dialog.getByLabel('Maximum instances or pods').fill('5');
  await dialog.getByLabel('Ready path (readiness)').fill('ready');
  await expect(dialog.getByText('Check this value')).toBeVisible();
  await dialog.getByLabel('Ready path (readiness)').fill('/ready');
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(dialog).toHaveCount(0);
  const max = table.getByRole('row', { name: /Maximum instances or pods/ });
  await expect(max).toContainText('5');
  await expect(max).toContainText('Set here');
  await expect(table.getByRole('row', { name: /Ready path/ })).toContainText('/ready');
  await page.screenshot({ path: info.outputPath('deploy-settings-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('deploy-settings-dark.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' });
  await staging.getByRole('button', { name: 'Clear' }).click();
  const confirm = page.getByRole('dialog', { name: 'Clear the settings made here for Staging?' });
  await confirm.getByRole('button', { name: 'Clear' }).click();
  await expect(confirm).toHaveCount(0);
  await expect(max).not.toContainText('Set here');
  await expectLoaded(page);

  // A variable naming another application's address, filled in where it is deployed.
  const listed = await page.request.get('/api/v1/pipelines/applications?limit=5');
  const other = ((await listed.json()) as { items: Array<{ key: string }> }).items.find(
    (item) => item.key !== 'checkout-api',
  );
  if (!other) throw new Error('Acme has one application only');
  await page.goto('/pipelines/applications/checkout-api?tab=variables');
  const variables = page.getByRole('region', { name: 'Variables' });
  await variables.getByRole('button', { name: /Add variable/ }).click();
  const add = page.getByRole('dialog', { name: 'Add a variable' });
  await add.getByLabel('Name').fill('PEER_URL');
  await add.getByRole('combobox', { name: "Insert another application's address" }).click();
  await page.keyboard.type(other.key);
  await page
    .getByRole('option', { name: new RegExp(`${other.key}: address in the same environment`) })
    .click();
  await expect(add.getByLabel('Value')).toHaveValue(`\${{ apps.${other.key}.url }}`);
  await add.getByRole('button', { name: 'Save variable' }).click();
  await expect(add).toHaveCount(0);
  const row = variables.getByRole('row', { name: /PEER_URL/ });
  await expect(row).toContainText(`apps.${other.key}.url`);
  await expect(row).toContainText(new RegExp(`${other.key} (is not deployed|has no)`));
  await page.screenshot({ path: info.outputPath('variable-address-light.png'), fullPage: true });
  const removed = await page.request.delete(
    '/api/v1/pipelines/applications/checkout-api/variables/PEER_URL',
    { headers: { origin: state.baseURL } },
  );
  expect(removed.status()).toBe(204);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pipelines/applications/checkout-api?tab=settings');
  await expect(page.getByRole('region', { name: 'Deploy settings' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('deploy-settings-phone.png'), fullPage: true });
  await expectLoaded(page);
});

import { expect, test, type Page } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';
import { readState } from '../support/state.ts';

/*
 * Adopting what already runs, then copying it on: an environment whose project holds Cloud Run
 * services deployed by hand shows them with what adopting each would import, and adopts them;
 * a fresh Prod on GKE Autopilot then takes that configuration, with the setting GKE lacks
 * dropped, Prod keeping its own minimum, and the secret left needing a value. The cloud
 * simulator stands in for Google Cloud: a project whose id ends in "-by-hand" holds
 * pricing-svc, promo-engine, search-api and a stray nightly-report.
 */

const STAGE = { key: 'pricing-stage', name: 'Pricing stage', project: 'acme-pricing-by-hand' };
const PROD = { key: 'pricing-prod', name: 'Pricing prod', project: 'acme-pricing-prod' };

async function send(page: Page, method: 'POST' | 'PUT', path: string, data: unknown) {
  const { baseURL } = readState();
  const answer = await page.request.fetch(`/api/v1/${path}`, {
    method,
    data,
    headers: { origin: baseURL },
  });
  if (!answer.ok()) throw new Error(`${method} ${path}: ${answer.status()} ${await answer.text()}`);
  return (await answer.json()) as { id: string };
}

test('adopt the services an environment runs, then copy them to a fresh Prod', async ({
  browser,
}, info) => {
  const page = await openPipelines(browser, '/platform/environments');
  await send(page, 'PUT', 'admin/settings/pipelines.providers.simulate', { value: true });
  const cloud = await send(page, 'POST', 'pipelines/clouds', {
    provider: 'gcp',
    name: 'Pricing on Google Cloud',
    mode: 'attached',
    signIn: 'application_default',
  });
  for (const environment of [STAGE, PROD]) {
    const account = await send(page, 'POST', `pipelines/clouds/${cloud.id}/accounts`, {
      externalId: environment.project,
    });
    await send(page, 'POST', 'pipelines/environments', {
      key: environment.key,
      name: environment.name,
      class: environment === PROD ? 'prod' : 'staging',
      cloudAccountId: account.id,
      ...(environment === PROD ? { defaultRuntime: 'gke-autopilot' } : {}),
    });
  }
  await page.reload();

  // The plan: every service, what it would import, and the stray one with nothing to match.
  await page.getByRole('button', { name: `Actions for ${STAGE.name}` }).click();
  await page.getByRole('menuitem', { name: 'Adopt services…' }).click();
  const adopt = page.getByRole('dialog', { name: `Adopt services in ${STAGE.name}` });
  await expect(adopt).toContainText(`${STAGE.project} · us-central1`);
  await expect(adopt).toContainText('Looking changes nothing in Google Cloud');
  const pricing = adopt.getByRole('region', { name: 'pricing-svc' });
  await expect(pricing.getByRole('checkbox', { name: 'Adopt pricing-svc' })).toBeChecked();
  await expect(pricing).toContainText(`${STAGE.project} / pricing-db-password, version 1`);
  await expect(pricing).toContainText('Release zero: fake.registry/');
  const promo = adopt.getByRole('region', { name: 'promo-engine' });
  await expect(
    promo.getByRole('checkbox', { name: /Use \$\{\{ apps\.pricing-svc\.url \}\}\/v1/ }),
  ).toBeChecked();
  const stray = adopt.getByRole('region', { name: 'nightly-report' });
  await expect(stray).toContainText('No application by this name');
  await expect(stray.getByRole('checkbox', { name: 'Adopt nightly-report' })).not.toBeChecked();
  await page.screenshot({ path: info.outputPath('adopt-plan-light.png') });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('adopt-plan-dark.png') });
  await page.emulateMedia({ colorScheme: 'light' });
  await adopt.getByRole('button', { name: 'Adopt 3 services' }).click();
  await expect(adopt.getByRole('status')).toContainText('Adopted 3 services');
  await adopt.getByRole('button', { name: 'Done' }).click();
  await expect(adopt).toHaveCount(0);

  // The copy to a fresh Prod on GKE Autopilot, translated, with the secret needing a value.
  await page.getByRole('button', { name: `Actions for ${PROD.name}` }).click();
  await page.getByRole('menuitem', { name: 'Copy configuration…' }).click();
  const copy = page.getByRole('dialog', { name: `Copy configuration to ${PROD.name}` });
  await copy.getByRole('combobox', { name: 'Copy from' }).click();
  await page.getByRole('option', { name: STAGE.name }).click();
  await expect(copy).toContainText('Prod secrets are often different');
  const plan = copy.getByRole('region', { name: 'pricing-svc' });
  await expect(plan).toContainText('Cloud Run to GKE Autopilot');
  await expect(plan).toContainText('GKE Autopilot has no such setting, so it is dropped.');
  await expect(plan).toContainText(`${PROD.name} keeps its default of 2 unless you tick this.`);
  await expect(
    plan.getByRole('checkbox', { name: 'Copy Minimum instances or pods for pricing-svc' }),
  ).not.toBeChecked();
  await expect(
    plan.getByRole('radiogroup', { name: `How DB_PASSWORD reaches ${PROD.name}` }),
  ).toBeVisible();
  await expect(plan.getByRole('radio', { name: 'Needs a value' })).toBeChecked();
  await expect(copy).toContainText('never copied');
  await page.screenshot({ path: info.outputPath('copy-plan-light.png') });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('copy-plan-dark.png') });
  await page.emulateMedia({ colorScheme: 'light' });
  await copy.getByRole('button', { name: /^Copy \d+ items$/ }).click();
  await expect(copy.getByRole('status')).toContainText(`to ${PROD.name}`);
  await copy.getByRole('button', { name: 'Done' }).click();

  // Copying again leaves only what was left unticked: nothing is ticked to copy.
  await page.getByRole('button', { name: `Actions for ${PROD.name}` }).click();
  await page.getByRole('menuitem', { name: 'Copy configuration…' }).click();
  await copy.getByRole('combobox', { name: 'Copy from' }).click();
  await page.getByRole('option', { name: STAGE.name }).click();
  await expect(copy.getByRole('region', { name: 'pricing-svc' })).toContainText('the same already');
  await expect(copy.getByRole('button', { name: 'Copy 0 items' })).toBeDisabled();
  await copy.getByRole('button', { name: 'Cancel' }).click();

  // The secret waits for its value in Prod.
  await page.goto(`/pipelines/applications/pricing-svc?tab=variables&env=${PROD.key}`);
  const row = page
    .getByRole('region', { name: 'Variables' })
    .getByRole('row', { name: /DB_PASSWORD/ })
    .filter({ hasText: 'Needs a value' });
  await expect(row).toBeVisible();
  await page.screenshot({ path: info.outputPath('needs-value-light.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pipelines/platform/environments');
  await page.getByRole('button', { name: `Actions for ${PROD.name}` }).click();
  await page.getByRole('menuitem', { name: 'Copy configuration…' }).click();
  await expect(copy.getByRole('combobox', { name: 'Copy from' })).toBeVisible();
  await expect(copy.getByRole('region', { name: 'pricing-svc' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('copy-plan-phone.png') });
  await copy.getByRole('button', { name: 'Cancel' }).click();
  await expectLoaded(page);
});

import { expect, test } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';
import { readState } from '../support/state.ts';

/*
 * Milestone one's journey on screen: Google Cloud connected with projects the company already
 * has, one attached and checked, an environment made in it and put on a tier's path. The
 * cloud simulator stands in for Google Cloud, so the attach check answers with no problems
 * and names the project "Simulated <id>". Keys differ from the seed's dev, staging and prod-*.
 */

const CONNECTION = 'Shop on Google Cloud';
const PROJECT = 'acme-shop-prod';

test('attach a project, create an environment in it and put it on a path', async ({ browser }) => {
  const state = readState();
  const page = await openPipelines(browser, '/platform/clouds');
  const simulate = await page.request.put('/api/v1/admin/settings/pipelines.providers.simulate', {
    data: { value: true },
    headers: { origin: state.baseURL },
  });
  expect(simulate.ok()).toBe(true);

  // Connect Google Cloud with projects it already has: no organisation, billing or layout.
  await page.goto('/pipelines/platform/clouds/connect');
  await page.getByRole('radio', { name: /Use projects I already have/ }).click();
  await expect(page.getByText('How environments map to projects')).toHaveCount(0);
  await expect(page.getByLabel('Organisation ID')).toHaveCount(0);
  await page.getByLabel('Name in Pipelines').fill(CONNECTION);
  await expect(page.getByRole('radio', { name: /The VM Bemmoly runs on/ })).toBeChecked();
  await page.getByRole('button', { name: 'Connect Google Cloud' }).click();

  // The connection's card, checked on arrival.
  await expect(page).toHaveURL(/\/platform\/clouds\?.*connection=/);
  const card = page.getByRole('region', { name: CONNECTION });
  await expect(card.getByRole('status')).toHaveText('Connected');
  await expect(card).toContainText('The VM Bemmoly runs on');

  // Attach a project; the check finds nothing missing. The button sits under this connection's
  // card, beside any other attached connection's.
  await card.locator('..').getByRole('button', { name: 'Attach a project…' }).click();
  const attach = page.getByRole('dialog', { name: `Attach a project to ${CONNECTION}` });
  await attach.getByLabel('Project ID').fill(PROJECT);
  await attach.getByRole('button', { name: 'Attach project' }).click();
  const attached = page.getByRole('dialog', { name: `${PROJECT} is attached` });
  await expect(attached).toContainText('Ready');
  await expect(attached).toContainText(`Simulated ${PROJECT}`);
  await attached.getByRole('button', { name: 'Done' }).click();
  const projects = page.getByRole('list', { name: `Projects attached to ${CONNECTION}` });
  await expect(projects).toContainText(PROJECT);
  await expect(projects).toContainText('Ready');
  await expectLoaded(page);

  // An environment in that project: Prod starts protected and asking for an approval.
  await page.goto('/pipelines/platform/environments');
  await page.getByRole('button', { name: 'New environment' }).click();
  const create = page.getByRole('dialog', { name: 'New environment' });
  await create.getByLabel('Name', { exact: true }).fill('Shop prod');
  await expect(create.getByLabel('Key')).toHaveValue('shop-prod');
  await create.getByRole('radio', { name: 'Prod' }).click();
  await expect(create.getByRole('checkbox', { name: /Protected/ })).toBeChecked();
  await expect(create.getByRole('checkbox', { name: /Needs an approval/ })).toBeChecked();
  await create.getByRole('combobox', { name: 'Project' }).click();
  await page.keyboard.type(PROJECT);
  await page.getByRole('option', { name: new RegExp(PROJECT) }).click();
  await expect(create.getByLabel('Region')).toHaveValue('us-central1');
  await create.getByRole('button', { name: 'Create environment' }).click();
  await expect(create).toHaveCount(0);

  const row = page.getByRole('row', { name: /Shop prod/ });
  await expect(row).toContainText('shop-prod');
  await expect(row).toContainText(`Simulated ${PROJECT}`);
  await expect(row).toContainText('Protected');

  // Put it on Tier 2's path.
  await page.getByRole('button', { name: 'Edit path for Tier 2' }).click();
  const path = page.getByRole('dialog', { name: 'Edit the Tier 2 path' });
  await path.getByRole('combobox', { name: 'Add an environment…' }).click();
  await page.getByRole('option', { name: /Shop prod/ }).click();
  await expect(path.getByRole('list', { name: 'Tier 2 path, in order' })).toContainText(
    'Shop prod',
  );
  await path.getByRole('button', { name: 'Save path' }).click();
  await expect(path).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Tier 2: environments in order' })).toContainText(
    'Shop prod',
  );
  await expectLoaded(page);
});

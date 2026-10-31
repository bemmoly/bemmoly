import { expect, test } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';
import { readState } from '../support/state.ts';

/*
 * Runner pools on GKE Autopilot on screen: a pool made in Capacity from an attached project,
 * on a cluster that exists there, with the size each runner pod asks for, then given more
 * room from its menu. The cloud simulator stands in for Google Cloud. An attached project
 * keeps its own clusters, so the dialog offers no cluster to create. The pool keeps no room
 * warm, so with no job waiting it has no pods and shows zero of everything.
 */

const CONNECTION = 'Pods on Google Cloud';
const PROJECT = 'acme-pods-ci';
const IMAGE = 'europe-west1-docker.pkg.dev/acme-pods-ci/bemmoly/runner-gke:1.7.0';

test('make a GKE Autopilot pool from an attached project and change it', async ({
  browser,
}, info) => {
  const state = readState();
  const page = await openPipelines(browser, '/platform/capacity');
  const headers = { origin: state.baseURL };
  const simulate = await page.request.put('/api/v1/admin/settings/pipelines.providers.simulate', {
    data: { value: true },
    headers,
  });
  expect(simulate.ok()).toBe(true);
  const connected = await page.request.post('/api/v1/pipelines/clouds', {
    data: {
      provider: 'gcp',
      mode: 'attached',
      name: CONNECTION,
      region: 'europe-west1',
      signIn: 'vm',
    },
    headers,
  });
  expect(connected.ok()).toBe(true);
  const { id } = (await connected.json()) as { id: string };
  const attached = await page.request.post(`/api/v1/pipelines/clouds/${id}/accounts`, {
    data: { externalId: PROJECT, deployerServiceAccount: null, runtimeServiceAccount: null },
    headers,
  });
  expect(attached.ok()).toBe(true);

  // Add a pool that runs on GKE Autopilot, on a cluster that exists in the project.
  await page.reload();
  await page.getByRole('button', { name: 'Add runner pool' }).click();
  const add = page.getByRole('dialog', { name: 'Add runner pool' });
  await add.getByLabel('Name', { exact: true }).fill('GKE runners');
  await add.getByRole('radio', { name: /GKE Autopilot/ }).click();
  await add.getByRole('combobox', { name: 'Project' }).click();
  await page.keyboard.type(PROJECT);
  await page.getByRole('option', { name: new RegExp(PROJECT) }).click();
  await expect(add.getByLabel('Region')).toHaveValue('europe-west1');
  await expect(add.getByLabel('Cluster')).toHaveValue('bemmoly-runners');
  await expect(add.getByText('An Autopilot cluster that exists in this project.')).toBeVisible();
  await expect(add.getByLabel('Create the cluster if it is missing')).toHaveCount(0);
  await add.getByLabel('Runner image').fill(IMAGE);
  await add.getByLabel('Memory per runner, GiB').fill('20');
  await expect(add.getByText('Use 1 to 6.5 GiB for each vCPU, and at most 80')).toBeVisible();
  await expect(add.getByRole('button', { name: 'Add runner pool' })).toBeDisabled();
  await add.getByLabel('Memory per runner, GiB').fill('8');
  await add.getByLabel('Use Spot capacity').check();
  await add.getByLabel('Pod service account').fill(`builder@${PROJECT}.iam.gserviceaccount.com`);
  await add.getByLabel('Fewest runners').fill('0');
  await add.getByLabel('Most runners at once').fill('4');
  await page.screenshot({ path: info.outputPath('autopilot-add-light.png'), fullPage: true });
  await add.getByRole('button', { name: 'Add runner pool' }).click();

  // No token: Pipelines starts the pods.
  const added = page.getByRole('dialog', { name: 'GKE runners is ready for runners' });
  await expect(added).toContainText('No token is needed');
  await added.getByRole('button', { name: 'Done' }).click();

  const row = page.getByRole('row', { name: /GKE runners/ });
  await expect(row).toContainText('GKE Autopilot · europe-west1 · bemmoly-runners');
  await expect(row).toContainText('0 of 4 pods');
  await expect(row).toContainText('0 running · 0 starting · 0 warm');
  await expect(page.getByRole('region', { name: 'Builds now' })).toContainText(
    'No builds right now',
  );
  await expectLoaded(page);
  await page.screenshot({ path: info.outputPath('autopilot-pools-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('autopilot-pools-dark.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' });

  // Change where it runs: more pods at once, with the settings it was made with.
  await row.getByRole('button', { name: 'Pool actions' }).click();
  await page.getByRole('menuitem', { name: 'Change where it runs…' }).click();
  const edit = page.getByRole('dialog', { name: 'Where GKE runners runs' });
  await expect(edit.getByRole('radio', { name: /GKE Autopilot/ })).toBeChecked();
  await expect(edit.getByLabel('Runner image')).toHaveValue(IMAGE);
  await expect(edit.getByLabel('Use Spot capacity')).toBeChecked();
  await edit.getByLabel('Most runners at once').fill('6');
  await edit.getByRole('button', { name: 'Save pool' }).click();
  await expect(edit).toHaveCount(0);
  await expect(row).toContainText('0 of 6 pods');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('autopilot-pools-phone.png'), fullPage: true });
  await expectLoaded(page);
});

import { expect, test } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';
import { readState } from '../support/state.ts';

/*
 * Build machines on screen: a pool that runs on Google Cloud Build, made in Capacity from an
 * attached project, then resized from its menu. The cloud simulator stands in for Google
 * Cloud, so the project attaches cleanly; no job waits in the pool, so no build starts and
 * Builds now says so. The connection and project are made through the API, as spec 6 covers
 * those screens.
 */

const CONNECTION = 'Builds on Google Cloud';
const PROJECT = 'acme-builds-ci';
const IMAGE = 'europe-west1-docker.pkg.dev/acme-builds-ci/bemmoly/runner:1.7.0';

test('make a Cloud Build pool from an attached project and change it', async ({ browser }) => {
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

  // Add a pool that runs on Cloud Build: the region comes from the project's connection.
  await page.reload();
  await page.getByRole('button', { name: 'Add runner pool' }).click();
  const add = page.getByRole('dialog', { name: 'Add runner pool' });
  await add.getByLabel('Name', { exact: true }).fill('Cloud builds');
  await expect(add.getByRole('radio', { name: /Machines you start/ })).toBeChecked();
  await add.getByRole('radio', { name: /Google Cloud Build/ }).click();
  await expect(add.getByLabel('Fewest runners')).toHaveCount(0);
  await add.getByRole('combobox', { name: 'Project' }).click();
  await page.keyboard.type(PROJECT);
  await page.getByRole('option', { name: new RegExp(PROJECT) }).click();
  await expect(add.getByLabel('Region')).toHaveValue('europe-west1');
  await add.getByLabel('Runner image').fill('not an image');
  await expect(add.getByText(/Use a full image name/)).toBeVisible();
  await expect(add.getByRole('button', { name: 'Add runner pool' })).toBeDisabled();
  await add.getByLabel('Runner image').fill(IMAGE);
  await add.getByLabel('Build service account').fill(`builder@${PROJECT}.iam.gserviceaccount.com`);
  await add.getByLabel('Most builds at once').fill('3');
  await add.getByRole('button', { name: 'Add runner pool' }).click();

  // No token for a Cloud Build pool: Pipelines starts its builds.
  const added = page.getByRole('dialog', { name: 'Cloud builds is ready for runners' });
  await expect(added).toContainText('No token is needed');
  await added.getByRole('button', { name: 'Done' }).click();

  const row = page.getByRole('row', { name: /Cloud builds/ });
  await expect(row).toContainText(`Google Cloud Build · europe-west1 · ${PROJECT}`);
  await expect(row).toContainText('0 of 3 builds');
  const builds = page.getByRole('region', { name: 'Builds now' });
  await expect(builds).toContainText('No builds right now');

  // Change where it runs: more builds at once.
  await row.getByRole('button', { name: 'Pool actions' }).click();
  await page.getByRole('menuitem', { name: 'Change where it runs…' }).click();
  const edit = page.getByRole('dialog', { name: 'Where Cloud builds runs' });
  await expect(edit.getByRole('radio', { name: /Google Cloud Build/ })).toBeChecked();
  await expect(edit.getByLabel('Runner image')).toHaveValue(IMAGE);
  await edit.getByLabel('Most builds at once').fill('5');
  await edit.getByRole('button', { name: 'Save pool' }).click();
  await expect(edit).toHaveCount(0);
  await expect(row).toContainText('0 of 5 builds');
  await expectLoaded(page);
});

import { expect, test, type APIRequestContext } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';
import { readState } from '../support/state.ts';

/*
 * Milestone five on screen: two environments get a cluster each, one created through Acme's
 * managed connection (GKE Standard) and one attached through a connection that uses projects
 * the company already has. checkout-api then switches to GKE in one of them, and the runtime
 * card says why the wrong kind of cluster would not take its next deploy. The cloud simulator
 * stands in for Google Cloud, so a created cluster finishes as soon as it is checked.
 */

const API = '/api/v1/pipelines';

async function json<T>(request: APIRequestContext, method: string, path: string, data?: unknown) {
  const state = readState();
  const response = await request.fetch(`${API}${path}`, {
    method,
    ...(data === undefined ? {} : { data }),
    headers: { origin: state.baseURL },
  });
  expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

test('create and attach clusters, then run an application on GKE', async ({ browser }) => {
  const state = readState();
  const page = await openPipelines(browser, '/platform/clusters');
  const request = page.request;
  const simulate = await request.put('/api/v1/admin/settings/pipelines.providers.simulate', {
    data: { value: true },
    headers: { origin: state.baseURL },
  });
  expect(simulate.ok()).toBe(true);

  // One environment in a project Acme's landing zone made, one in a project attached as it is.
  const clouds = await json<{ items: Array<{ id: string; name: string }> }>(
    request,
    'GET',
    '/clouds',
  );
  const acme = clouds.items.find((connection) => connection.name === 'Acme Google Cloud');
  const projects = await json<{
    items: Array<{ id: string; externalId: string; purpose: string }>;
  }>(request, 'GET', `/clouds/${acme?.id}/accounts`);
  const managedProject = projects.items.find(
    (account) => account.purpose === 'workload' && account.externalId.endsWith('-dev'),
  );
  await json(request, 'POST', '/environments', {
    key: 'gke-dev',
    name: 'GKE dev',
    class: 'dev',
    cloudAccountId: managedProject?.id,
    region: 'us-central1',
  });
  const own = await json<{ id: string }>(request, 'POST', '/clouds', {
    provider: 'gcp',
    name: 'Clusters on Google Cloud',
    mode: 'attached',
    signIn: 'application_default',
  });
  const attached = await json<{ id: string }>(request, 'POST', `/clouds/${own.id}/accounts`, {
    externalId: 'acme-platform-dev',
  });
  await json(request, 'POST', '/environments', {
    key: 'gke-attached',
    name: 'GKE attached',
    class: 'staging',
    cloudAccountId: attached.id,
    region: 'europe-west1',
  });

  // Create a Standard cluster for GKE dev through the managed connection.
  await page.goto('/pipelines/platform/clusters');
  const list = page.getByRole('list', { name: 'Clusters by environment' });
  const dev = list.getByRole('listitem', { name: 'GKE dev' });
  await expect(dev).toContainText('No cluster. Applications here run on Cloud Run.');
  await dev.getByRole('button', { name: 'Create a cluster…' }).click();
  const create = page.getByRole('dialog', { name: 'Create a cluster for GKE dev' });
  await expect(create).toContainText('Regular release channel');
  await create.getByRole('radio', { name: 'Standard' }).click();
  await expect(create.getByLabel('Cluster name')).toHaveValue('bemmoly-gke-dev');
  await create.getByRole('button', { name: 'Create cluster' }).click();
  const creating = page.getByRole('dialog', { name: 'bemmoly-gke-dev is being created' });
  await expect(creating).toContainText('GKE Standard');
  await creating.getByRole('button', { name: 'Done' }).click();
  await dev.getByRole('button', { name: 'Check again' }).click();
  await expect(dev.getByText('Ready', { exact: true })).toBeVisible();
  await expect(dev).toContainText('regular release channel');

  // Attach an existing cluster to GKE attached; the simulated check finds nothing missing.
  const other = list.getByRole('listitem', { name: 'GKE attached' });
  await other.getByRole('button', { name: 'Attach a cluster…' }).click();
  const attach = page.getByRole('dialog', { name: 'Attach a cluster to GKE attached' });
  await expect(attach.getByLabel('Project ID')).toHaveValue('acme-platform-dev');
  await expect(attach.getByLabel('Location')).toHaveValue('europe-west1');
  await attach.getByLabel('Cluster name').fill('platform-dev');
  await attach.getByRole('button', { name: 'Attach cluster' }).click();
  const ready = page.getByRole('dialog', { name: 'platform-dev is ready' });
  await expect(ready).toContainText('Attached cluster');
  await ready.getByRole('button', { name: 'Done' }).click();
  await expect(other.getByText('Ready', { exact: true })).toBeVisible();
  await expectLoaded(page);

  // checkout-api runs on GKE Standard in GKE dev; GKE Autopilot there would not deploy.
  await page.goto('/pipelines/applications/checkout-api');
  const card = page.getByRole('region', { name: 'Where it runs' });
  await expect(card).toContainText('A switch takes effect on the next deploy.');
  const runtime = card.getByRole('combobox', { name: 'Runtime in GKE dev' });
  await expect(runtime).toHaveText('Default: Cloud Run');
  await runtime.click();
  await page.getByRole('option', { name: 'GKE Autopilot' }).click();
  await expect(card).toContainText(
    "gke-dev's cluster bemmoly-gke-dev is GKE Standard, not GKE Autopilot",
  );
  await runtime.click();
  await page.getByRole('option', { name: 'GKE Standard' }).click();
  await expect(runtime).toHaveText('GKE Standard');
  await expect(card).not.toContainText('not GKE Autopilot');
  const runtimes = await json<{ items: Array<{ environment: { key: string }; runtime: string }> }>(
    request,
    'GET',
    '/applications/checkout-api/runtimes',
  );
  expect(runtimes.items.find((item) => item.environment.key === 'gke-dev')?.runtime).toBe(
    'gke-standard',
  );
  await runtime.click();
  await page.getByRole('option', { name: 'Default: Cloud Run' }).click();
  await expect(runtime).toHaveText('Default: Cloud Run');
  await expectLoaded(page);
});

import { expect, test, type APIRequestContext } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';
import { readState } from '../support/state.ts';

/*
 * The front door on screen: Prod in us-east1 gets a cluster and its front door, which gives
 * every application released there a host at its runtime. One of them switches to GKE
 * Autopilot; the switch plans a move whose screen shows the steps, the downtime, the month's
 * cost and what is untested before anything starts, and then starts, pauses, continues and
 * rolls back. The cloud simulator stands in for Google Cloud.
 */

const API = '/api/v1/pipelines';
const ENV = 'prod-us-east1';
const ENV_NAME = 'Prod · us-east1';
const LIVE = ['pending', 'deploying', 'canary', 'waiting'];

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

test('turn on a front door, then plan and run a move to GKE', async ({ browser }, info) => {
  const state = readState();
  const page = await openPipelines(browser, '/platform/environments');
  const request = page.request;
  const simulate = await request.put('/api/v1/admin/settings/pipelines.providers.simulate', {
    data: { value: true },
    headers: { origin: state.baseURL },
  });
  expect(simulate.ok()).toBe(true);

  // Prod us-east1 deploys into Commerce's project, and gets an Autopilot cluster there.
  const clouds = await json<{ items: Array<{ id: string; name: string }> }>(
    request,
    'GET',
    '/clouds',
  );
  const acme = clouds.items.find((connection) => connection.name === 'Acme Google Cloud');
  const accounts = await json<{ items: Array<{ id: string; externalId: string }> }>(
    request,
    'GET',
    `/clouds/${acme?.id}/accounts`,
  );
  const commerce = accounts.items.find((account) => account.externalId === 'acme-commerce-prod');
  const environment = await json<{ id: string }>(request, 'PATCH', `/environments/${ENV}`, {
    cloudAccountId: commerce?.id,
  });
  const cluster = await json<{ id: string }>(request, 'POST', '/clusters', {
    origin: 'created',
    environmentId: environment.id,
    mode: 'autopilot',
  });
  await json(request, 'POST', `/clusters/${cluster.id}/check`);

  // Turn the front door on from its row; without a domain it answers on the address.
  await page.goto('/pipelines/platform/environments');
  const doors = page.getByRole('list', { name: 'Front doors by environment' });
  const row = doors.getByRole('listitem', { name: ENV_NAME });
  await row.getByRole('button', { name: 'Turn on…' }).click();
  const dialog = page.getByRole('dialog', { name: `Front door for ${ENV_NAME}` });
  await expect(dialog.getByRole('switch', { name: 'Front door on' })).toBeChecked();
  await expect(dialog).toContainText('each called with its key as the Host header');
  await dialog.getByLabel('Domain').fill('not a domain');
  await expect(dialog).toContainText('Name a domain such as prod.example.com');
  await dialog.getByLabel('Domain').fill('');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(row.getByText('Ready', { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(row).toContainText(/203\.0\.113\.\d+/);
  await expect(row).toContainText('No domain: HTTP on the address');
  await expectLoaded(page);
  await page.screenshot({ path: info.outputPath('front-doors-light.png'), fullPage: true });

  // An application the front door serves, with no deploy under way there.
  const listed = await json<{
    items: Array<{ environment: { key: string }; routes: Array<{ application: { key: string } }> }>;
  }>(request, 'GET', '/front-doors');
  const routes = listed.items.find((door) => door.environment.key === ENV)?.routes ?? [];
  expect(routes.length).toBeGreaterThan(0);
  let application = '';
  for (const route of routes) {
    const key = route.application.key;
    const deployments = await json<{ items: Array<{ state: string }> }>(
      request,
      'GET',
      `/deployments?application=${key}&environment=${ENV}`,
    );
    if (!deployments.items.some((deployment) => LIVE.includes(deployment.state))) {
      application = key;
      break;
    }
  }
  expect(application).not.toBe('');

  // Switching its runtime plans a move instead of waiting for the next deploy.
  await page.goto(`/pipelines/applications/${application}`);
  const door = page.getByRole('region', { name: 'Front door' });
  await expect(door).toContainText(ENV_NAME);
  await expect(door).toContainText('Cloud Run 100%');
  const card = page.getByRole('region', { name: 'Where it runs' });
  await expect(card).toContainText('Where a front door serves it, a switch plans a move');
  await card.getByRole('combobox', { name: `Runtime in ${ENV_NAME}` }).click();
  await page.getByRole('option', { name: 'GKE Autopilot' }).click();
  await card.getByRole('link', { name: 'Move to GKE Autopilot planned. Review the plan' }).click();

  // The plan first: steps, downtime, cost and what is untested.
  await expect(
    page.getByRole('heading', { name: `Move ${application} to GKE Autopilot` }),
  ).toBeVisible();
  const steps = page.getByRole('list', { name: 'Steps' });
  for (const share of ['10%', '50%', '100%']) await expect(steps).toContainText(share);
  await expect(steps).toContainText('Remove Cloud Run');
  await expect(page.getByText('None', { exact: true })).toBeVisible();
  const cost = page.getByRole('table', { name: 'Cost per month' });
  await expect(cost).toContainText('Front door forwarding rule, shared');
  await expect(cost).toContainText('GKE Autopilot cluster fee, shared');
  await expect(page.getByText('Estimates from list prices on 2026-10-29')).toBeVisible();
  await expect(page.getByText(/The move (saves|adds) about \$/)).toBeVisible();
  await expect(page.getByText(/simulated cloud/)).toBeVisible();
  await expectLoaded(page);
  await page.screenshot({ path: info.outputPath('move-plan-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('move-plan-dark.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' });

  // Start, pause, continue, roll back.
  await page.getByRole('button', { name: 'Start the move' }).click();
  await expect(page.getByText('10% moved')).toBeVisible();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('Paused at 10%')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('10% moved')).toBeVisible();
  await page.screenshot({ path: info.outputPath('move-running-light.png'), fullPage: true });
  await page.getByRole('button', { name: 'Roll back' }).click();
  await expect(page.getByText('Rolled back', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start the move' })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('move-phone.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expectLoaded(page);

  // Back on the application, every request is on Cloud Run again.
  await page.getByRole('button', { name: 'Back to the application' }).click();
  await expect(page.getByRole('region', { name: 'Front door' })).toContainText('Cloud Run 100%');
  await expect(
    page.getByRole('region', { name: 'Where it runs' }).getByRole('combobox', {
      name: `Runtime in ${ENV_NAME}`,
    }),
  ).toHaveText('Default: Cloud Run');
});

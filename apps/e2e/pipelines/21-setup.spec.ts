import { expect, test, type Page } from '@playwright/test';
import { startFreshInstall, type FreshInstall } from '../support/fresh-install.ts';
import { expectLoaded } from '../support/pipelines.ts';

/*
 * A fresh install, set up from the checklist on For you: nothing is switched on, connecting a
 * cloud creates nothing and comes back to the checklist, the suggested setup only fills a form
 * the installer changes and confirms, environments are equal, and Start over leaves the install
 * fresh again. Its own install, so the seeded one the other journeys share is untouched. The
 * cloud simulator stands in for Google Cloud.
 */

let fresh: FreshInstall;

test.beforeAll(async () => {
  fresh = await startFreshInstall();
});

test.afterAll(async () => {
  await fresh?.stop();
});

async function open(browser: import('@playwright/test').Browser, path = '/'): Promise<Page> {
  const context = await browser.newContext({
    baseURL: fresh.baseURL,
    storageState: fresh.storageState,
  });
  const page = await context.newPage();
  await page.goto(`/pipelines${path}`);
  return page;
}

const checklist = (page: Page) => page.getByRole('list', { name: 'Set up Pipelines' });

test('set up a fresh install from the checklist, then start over', async ({ browser }) => {
  test.setTimeout(240_000);
  const page = await open(browser);

  // For you is the checklist; everything starts off.
  await expect(page.getByRole('heading', { name: /Welcome, Asha/ })).toBeVisible();
  await expect(page.getByText('0 of 6 done').first()).toBeVisible();
  const on = page.getByRole('definition').filter({ hasText: /./ });
  await expect(page.getByLabel("What's switched on")).toContainText('Deploy on push');
  await expect(on.filter({ hasText: 'None' }).first()).toBeVisible();
  await expect(checklist(page)).toContainText('Needs a connected cloud');
  await expectLoaded(page);

  // Connect a cloud: a setup page, with the way back to the checklist.
  await page.getByRole('link', { name: 'Connect: Connect a cloud' }).click();
  await expect(page).toHaveURL(/\/pipelines\/setup\/cloud$/);
  await expect(page.getByRole('link', { name: /Back to the checklist/ })).toBeVisible();
  await expect(page.getByText(/the command to grant access appears here/)).toBeVisible();

  // Someone who has never made a workload identity file is shown how.
  await page.getByRole('radio', { name: /A workload identity file/ }).check();
  const guide = page.getByRole('region', { name: 'How to make this file' });
  await expect(guide).toContainText("Choose 'The machine Bemmoly runs on' instead");
  await expect(guide).toContainText('Create pool, named bemmoly');
  await expect(
    page.getByRole('link', { name: 'Get it from the Google Cloud console' }),
  ).toHaveAttribute('href', 'https://console.cloud.google.com/iam-admin/workload-identity-pools');
  await guide.getByRole('tab', { name: 'With gcloud' }).click();
  await guide.getByLabel('Project ID').fill('example-tools');
  await guide.getByLabel('Project number').fill('123456789012');
  const commands = guide.getByLabel('Commands that make the workload identity file');
  await expect(commands).toContainText('bemmoly@example-tools.iam.gserviceaccount.com');
  await expect(commands).toContainText(
    'projects/123456789012/locations/global/workloadIdentityPools/bemmoly/*',
  );
  await expect(commands).toContainText('--output-file=bemmoly-wif.json');

  // The VM's account, and only the projects picked: the command grants exactly that.
  await page.getByRole('radio', { name: /The machine Bemmoly runs on/ }).check();
  await expect(guide).toHaveCount(0);
  await page.getByRole('radio', { name: /Only the projects I pick/ }).check();
  await page.getByLabel(/Project IDs/).fill('example-dev, example-stage, example-prod');
  const grant = page.getByLabel('Command that grants access');
  await expect(grant).toContainText('for PROJECT in example-dev example-stage example-prod; do');
  await expect(grant).not.toContainText('folders');
  await page.getByRole('button', { name: 'Check access' }).click();
  const seen = page.getByRole('table', { name: 'Projects Bemmoly can see' });
  await expect(seen).toContainText('example-dev');
  await expect(seen).toContainText('example-prod');
  await page.getByRole('button', { name: 'Connect Google Cloud' }).click();

  // Back on the checklist, the step done.
  await expect(page).toHaveURL(/\/pipelines\/?$/);
  await expect(page.getByText('Google Cloud connected. Nothing was created.')).toBeVisible();
  await expect(page.getByText('1 of 6 done').first()).toBeVisible();

  // Add environments from the suggested setup, changing it before anything is made.
  await page.getByRole('link', { name: 'Add: Add environments' }).click();
  await expect(page).toHaveURL(/\/pipelines\/environments$/);
  await expect(page.getByText('No environments yet')).toBeVisible();
  await page.getByRole('button', { name: 'Use a suggested setup' }).click();
  const dialog = page.getByRole('dialog', { name: 'Suggested setup' });
  const last = dialog.getByRole('group', { name: 'Last environment' });
  await expect(last.getByRole('checkbox')).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: /Stage needs approval/ })).not.toBeChecked();
  await expect(last.getByLabel('Name')).toHaveValue('Production');
  await expect(last.getByLabel('ID, used in pipeline files')).toHaveValue('production');
  await last.getByLabel('Name').fill('Live');
  await last.getByLabel('ID, used in pipeline files').fill('live');
  await expect(dialog.getByRole('checkbox', { name: 'Live needs approval' })).toBeChecked();
  const second = dialog.getByRole('group', { name: 'Second environment' });
  await expect(second.getByRole('combobox', { name: 'Project' })).toContainText('example-stage');
  await second.getByRole('combobox', { name: 'Project' }).click();
  await page.getByRole('option', { name: 'example-dev' }).click();
  await expect(second.getByRole('combobox', { name: 'Project' })).toContainText('example-dev');
  await second.getByRole('combobox', { name: 'Project' }).click();
  await page.getByRole('option', { name: 'example-stage' }).click();
  await dialog.getByRole('button', { name: 'Create 5 things' }).click();

  await expect(page).toHaveURL(/\/pipelines\/?$/);
  await expect(page.getByText('Created 3 environments and Live approvers.')).toBeVisible();
  await expect(page.getByText('2 of 6 done').first()).toBeVisible();
  await expect(page.getByLabel("What's switched on")).toContainText('Dev, Stage, Live');
  await expect(page.getByLabel("What's switched on")).toContainText('Live: 1 of Live approvers');

  // Equal environments, each setting listed; the path reorders.
  await page.goto('/pipelines/environments');
  const path = page.getByRole('list', { name: 'Environments in the order versions move' });
  await expect(path.getByRole('region')).toHaveText([/^Dev/, /^Stage/, /^Live/]);
  const live = page.getByRole('region', { name: 'Live' });
  await expect(live).toContainText('example-prod');
  await expect(live).toContainText('1 of Live approvers');
  await expect(live).toContainText('Passed Stage');
  await expect(page.getByRole('region', { name: 'Dev' })).toContainText('Any version');
  await page.getByRole('button', { name: 'Move Live earlier' }).click();
  await expect(path.getByRole('region')).toHaveText([/^Dev/, /^Live/, /^Stage/]);
  await page.getByRole('button', { name: 'Move Live later' }).click();
  await expect(path.getByRole('region')).toHaveText([/^Dev/, /^Stage/, /^Live/]);
  await expectLoaded(page);

  // The approval rule, step by step; no environment is special.
  await page.goto('/pipelines/platform/approvals');
  await expect(page.getByRole('region', { name: 'Live' })).toContainText('Change request');
  await expect(page.getByRole('region', { name: 'Live' })).toContainText(
    'Nobody approves their own change',
  );
  await expect(page.getByRole('region', { name: 'Dev' })).toContainText('No approval');

  // Start over: a typed confirmation, then the checklist of a fresh install.
  await page.goto('/pipelines/platform/settings');
  await page.getByRole('button', { name: 'Start over…' }).click();
  const confirm = page.getByRole('dialog', { name: 'Start Pipelines over?' });
  const remove = confirm.getByRole('button', { name: 'Remove everything and start over' });
  await expect(remove).toBeDisabled();
  await confirm.getByLabel(/Type "start over"/).fill('start over');
  await remove.click();
  await expect(page).toHaveURL(/\/pipelines\/?$/);
  await expect(page.getByText('0 of 6 done').first()).toBeVisible();
  await expect(checklist(page)).toContainText('Needs a connected cloud');
});

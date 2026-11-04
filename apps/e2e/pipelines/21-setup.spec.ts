import { expect, test, type Browser, type Page } from '@playwright/test';
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

async function open(browser: Browser, path = '/'): Promise<Page> {
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
  await expect(page.getByText(/the steps appear here/)).toBeVisible();

  // Create projects from a laptop: numbered steps, each command filled in from what was typed
  // and never shown while a value is missing.
  await page.getByRole('radio', { name: /Create projects for me/ }).check();
  await page.getByRole('radio', { name: /A gcloud sign-in on this machine/ }).check();
  const steps = page.getByRole('list', { name: 'Steps to connect Google Cloud' });
  const step = (title: string) => steps.getByRole('listitem', { name: title });
  const bootstrap = step('1. Run the setup script');
  await expect(bootstrap).toContainText(
    'Fill in Organization ID, Billing account, Control project ID to see the command.',
  );
  await expect(bootstrap.getByLabel('Folder name')).toHaveValue('Bemmoly Pipelines');
  await bootstrap.getByLabel('Organization ID').fill('583920174411');
  await bootstrap.getByLabel('Billing account').fill('01A2B3-C4D5E6-F7A8B9');
  await expect(bootstrap.getByLabel('Control project ID')).toHaveValue(
    'bemmoly-control-583920174411',
  );
  const script = bootstrap.getByLabel('Command for step 1');
  await expect(script).toContainText('--org 583920174411 --billing 01A2B3-C4D5E6-F7A8B9');
  await expect(script).toContainText("--folder-name 'Bemmoly Pipelines'");
  await expect(script).toContainText('--region us-central1 --mode none');
  await expect(bootstrap.getByRole('link', { name: 'Open Cloud Shell' })).toBeVisible();
  const account = 'bemmoly-control@bemmoly-control-583920174411.iam.gserviceaccount.com';
  const token = step('2. Let yourself act as bemmoly-control');
  await expect(token.getByLabel('Command for step 2')).toHaveCount(0);
  await token.getByLabel('Your Google account').fill('asha@example.com');
  await expect(token.getByLabel('Command for step 2')).toContainText(
    `add-iam-policy-binding ${account}`,
  );
  await expect(step('3. Sign in on this machine as that account')).toContainText(
    `gcloud auth application-default login --impersonate-service-account=${account}`,
  );
  await expect(step('4. Let Bemmoly’s container read that sign-in')).toContainText(
    'Only if Bemmoly runs in Docker',
  );
  await step('5. Paste the folder ID').getByLabel('Folder ID').fill('417302018845');
  await page.getByRole('button', { name: 'Check access' }).click();
  // The simulator signs in as someone else, so Check names the step to run again.
  const found = page.getByRole('list', { name: 'What Check found' });
  await expect(found).toContainText(
    `Your sign-in is acting as fake-control@Google Cloud, not ${account}. Run step 3.`,
  );
  await expect(page.getByRole('button', { name: 'Connect Google Cloud' })).toHaveCount(0);

  // The workload identity file is the advanced choice, with the guide to making one.
  await page.getByRole('radio', { name: /Use projects I already have/ }).check();
  await page.getByRole('radio', { name: /A workload identity file/ }).check();
  const guide = page.getByRole('region', { name: 'How to make this file' });
  await expect(guide).toContainText('Choose ‘The machine Bemmoly runs on’');
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
  const grantStep = step('1. Grant access');
  await expect(grantStep).toContainText('Choose what Bemmoly can reach to see the command.');
  await expect(grantStep.getByLabel('Bemmoly signs in as')).toHaveValue(
    'fake-control@Google Cloud',
  );
  await page.getByRole('radio', { name: /Only the projects I pick/ }).check();
  await page.getByLabel(/Project IDs/).fill('example-dev, example-stage, example-prod');
  const grant = page.getByLabel('Command for step 1');
  await expect(grant).toContainText('for PROJECT in example-dev example-stage example-prod; do');
  await expect(grant).not.toContainText('folders');
  await page.getByRole('button', { name: 'Check access' }).click();
  await expect(page.getByRole('list', { name: 'What Check found' })).toContainText(
    'Bemmoly can deploy to 3 projects.',
  );
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

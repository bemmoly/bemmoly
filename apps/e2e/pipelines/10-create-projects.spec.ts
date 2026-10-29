import { expect, test } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';
import { readState } from '../support/state.ts';

/*
 * Milestone four's journey on screen: Google Cloud connected with what bootstrap.sh printed,
 * the folder grant checked, Starter planned with its projects, registry and billing headroom,
 * applied project by project, and a switch to Standard previewed that keeps the Starter
 * projects. The cloud simulator stands in for Google Cloud, so the check passes and the
 * billing account pays for nothing yet.
 */

const CONNECTION = 'Starter Cloud';

test('create projects for me: check the grant, apply Starter, preview a switch', async ({
  browser,
}) => {
  const state = readState();
  const page = await openPipelines(browser, '/platform/clouds');
  const simulate = await page.request.put('/api/v1/admin/settings/pipelines.providers.simulate', {
    data: { value: true },
    headers: { origin: state.baseURL },
  });
  expect(simulate.ok()).toBe(true);

  // What bootstrap.sh printed: no organisation, the folder alone.
  await page.goto('/pipelines/platform/clouds/connect');
  await expect(page.getByRole('radio', { name: /Create projects for me/ })).toBeChecked();
  await expect(page.getByLabel('Organisation ID')).toHaveCount(0);
  await page.getByLabel('Name in Pipelines').fill(CONNECTION);
  await page.getByLabel('Folder ID').fill('417302018845');
  await page.getByLabel('Billing account').fill('01A2B3-C4D5E6-F7A8B9');
  await page.getByLabel('Control project').fill('bemmoly-control-583920174411');
  await page.getByRole('button', { name: 'Connect and check' }).click();

  // The grant is checked on arrival; Starter is chosen and planned.
  await expect(page).toHaveURL(/connection=/);
  const connectionId = new URL(page.url()).searchParams.get('connection') ?? '';
  const grant = page.getByRole('region', { name: 'The folder grant' });
  await expect(grant.getByRole('status')).toHaveText('Bemmoly holds what it needs');
  await expect(page.getByRole('radio', { name: /^Starter/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  const tree = page.getByRole('list', { name: 'What will be created' });
  for (const name of ['Bemmoly platform', 'Non-production', 'Production']) {
    await expect(tree).toContainText(name);
  }
  await expect(page.getByText(/and this plan adds 2/)).toBeVisible();
  await expectLoaded(page);

  // Create follows the apply until every project is ready.
  await page.getByRole('button', { name: 'Create 2 projects' }).click();
  await expect(page).toHaveURL(/plan=/);
  await expect(page.getByText('The landing zone is ready')).toBeVisible({ timeout: 60_000 });
  const made = page.getByRole('list', { name: 'Creating the landing zone' });
  await expect(made).toContainText('Non-production');
  await expect(made).toContainText('Production');
  await expect(made.locator('li[data-state="done"]')).toHaveCount(3);

  // A switch to Standard adds projects and moves environments, and keeps Starter's.
  await page.goto(`/pipelines/platform/clouds/connect?connection=${connectionId}`);
  await page.getByRole('radio', { name: /^Standard/ }).click();
  await tree.getByRole('button', { name: /more$/ }).click();
  await expect(tree.getByText('Kept', { exact: true })).toHaveCount(2);
  const warnings = page.getByRole('list', { name: 'Before you create' });
  await expect(warnings).toContainText('moves from');
  await expect(warnings).toContainText('never deletes a project');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/platform\/clouds/);
  await expect(page.getByText('Layout: Starter')).toBeVisible();
  await expectLoaded(page);
});

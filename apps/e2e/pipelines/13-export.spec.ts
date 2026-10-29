import { readFileSync } from 'node:fs';
import { expect, test, type Download } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';
import { readState } from '../support/state.ts';

/*
 * Export on screen: Platform › Export shows Acme's connection as a directory of Terraform and
 * Helm with what it left out, downloads the whole bundle as a zip, and checkout-api's page
 * downloads its services alone. The cloud simulator stands in for Google Cloud, so the facts
 * an export reads (project numbers, folders) come from it and nothing calls Google.
 */

const CONNECTION = 'Acme Google Cloud';
const DIRECTORY = 'acme-google-cloud';

/** The names in a zip, read from its central directory as any unzip tool does. */
async function namesIn(download: Download): Promise<string[]> {
  const zip = readFileSync(await download.path());
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(end, 'the download is a zip').toBeGreaterThan(0);
  const names: string[] = [];
  let at = zip.readUInt32LE(end + 16);
  for (let i = 0; i < zip.readUInt16LE(end + 10); i += 1) {
    const length = zip.readUInt16LE(at + 28);
    names.push(zip.toString('utf8', at + 46, at + 46 + length));
    at += 46 + length + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
  }
  return names;
}

test('export what Pipelines made as Terraform and Helm, then one application', async ({
  browser,
}) => {
  const state = readState();
  const page = await openPipelines(browser, '/platform/access');
  const simulate = await page.request.put('/api/v1/admin/settings/pipelines.providers.simulate', {
    data: { value: true },
    headers: { origin: state.baseURL },
  });
  expect(simulate.ok()).toBe(true);

  // Export is a Platform place: each connection is a directory, with its files listed.
  await page.getByRole('link', { name: 'Export' }).click();
  await expect(page).toHaveURL(/\/platform\/export$/);
  const card = page.getByRole('region', { name: CONNECTION });
  await expect(card).toContainText('Managed by Pipelines');
  const files = card.getByRole('list', { name: `Files from ${CONNECTION}` });
  for (const file of ['README.md', 'terraform/versions.tf', 'terraform/imports.tf']) {
    await expect(files.getByText(file, { exact: true })).toBeVisible();
  }
  await expect(files.getByText('terraform/front-door.tf', { exact: true })).toBeVisible();
  await expect(card.getByRole('list', { name: 'Left out' })).toContainText('Revision history');
  await expectLoaded(page);

  // Download export: one zip, a README at the top and the connection's directory.
  const whole = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download export' }).click();
  const bundle = await whole;
  expect(bundle.suggestedFilename()).toMatch(/^bemmoly-pipelines-export-\d{4}-\d{2}-\d{2}\.zip$/);
  const names = await namesIn(bundle);
  expect(names).toContain('README.md');
  for (const file of ['README.md', 'terraform/versions.tf', 'terraform/variables.tf']) {
    expect(names).toContain(`${DIRECTORY}/${file}`);
  }
  expect(names).toContain(`${DIRECTORY}/terraform/terraform.tfvars`);
  await expect(page.getByText(/^Downloading bemmoly-pipelines-export-/)).toBeVisible();
  // Light, dark and phone, for the pull request.
  await page.screenshot({ path: test.info().outputPath('export-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: test.info().outputPath('export-dark.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: test.info().outputPath('export-phone.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'light' });

  // An application's own Export narrows the bundle to its services.
  await page.goto('/pipelines/applications/checkout-api');
  const one = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const app = await one;
  expect(app.suggestedFilename()).toMatch(/^bemmoly-pipelines-export-checkout-api-/);
  const appNames = await namesIn(app);
  expect(appNames).toContain('README.md');
  expect(appNames).toContain(`${DIRECTORY}/terraform/cloud-run.tf`);
  expect(appNames).not.toContain(`${DIRECTORY}/terraform/landing-zone.tf`);
  await expectLoaded(page);
});

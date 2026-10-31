import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';
import { REPO_ROOT, statePath } from '../support/state.ts';

/*
 * A monorepo with one repository file. `demo:monorepo` applies Acme Market's files as a push
 * to its default branch would: three services on a shared Dockerfile from the central list, a
 * web app with its own application.yaml, and a library. Each application's page says where its
 * settings come from, the library says it makes no releases, and Set up shows the repository
 * file it proposes for the same tree with no Bemmoly files.
 */

const run = promisify(execFile);

test('a repository file defines a monorepo, and Set up proposes one', async ({ browser }) => {
  const { stdout } = await run(
    process.execPath,
    [`--env-file=${statePath('server.env')}`, 'modules/pipelines/scripts/monorepo-demo.ts'],
    { cwd: REPO_ROOT },
  );
  expect(stdout).toContain(
    'acme/market: applied market-invoices, market-money, market-orders, market-shipping, market-web',
  );

  // A service from the central list: defaults give it the build, its entry its tier.
  const page = await openPipelines(browser, '/applications/market-orders');
  const card = page.getByTestId('settings-card');
  await expect(card).toContainText('Defined in');
  await expect(card).toContainText('.bemmoly/repository.yaml');
  await expect(card.locator('div', { hasText: 'Central list' }).last()).toContainText('tier');
  await expect(card.locator('div', { hasText: 'Defaults' }).last()).toContainText(
    'build, domain, group, owner, paths, pipeline',
  );
  await expect(card.getByText('Library')).toHaveCount(0);
  await expectLoaded(page);
  await page.screenshot({ path: test.info().outputPath('settings-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: test.info().outputPath('settings-dark.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' });

  // The web app's own file beats the defaults for its build.
  await page.goto('/pipelines/applications/market-web');
  await expect(card).toContainText('apps/market-web/.bemmoly/application.yaml');
  await expect(card.locator('div', { hasText: 'Its own file' }).last()).toContainText('build');

  // The library is checked and never ships.
  await page.goto('/pipelines/applications/market-money');
  await expect(card.getByText('Library', { exact: true })).toBeVisible();
  await expect(card).toContainText('It builds no image, so it makes no releases');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: test.info().outputPath('library-phone.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });

  // Set up: the same tree with no Bemmoly files gets one repository file, not five.
  await page.goto('/pipelines/start');
  const proposed = page.getByRole('region', {
    name: 'Proposed repository file for acme/market-next',
  });
  await expect(proposed).toContainText('One repository file for acme/market-next');
  await expect(proposed).toContainText('dockerfile: docker/service.Dockerfile');
  await expect(proposed).toContainText('SERVICE: ${{ app.name }}');
  await expect(proposed).toContainText('name: market-orders');
  await expectLoaded(page);
  await proposed.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('proposed-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: test.info().outputPath('proposed-dark.png'), fullPage: true });
});

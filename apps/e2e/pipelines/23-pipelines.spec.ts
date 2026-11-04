import { expect, test, type Page } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';

/*
 * Setting up a service's pipeline: nothing is chosen until the person chooses, "Use suggested"
 * only fills the form, the pipeline starts with no triggers, and the editor adds one, adds a
 * step and saves. Platform › Templates shows the built-in templates; Runs runs a pipeline by
 * hand.
 */

/** A seeded service no other walkthrough uses, with no pipeline setup yet. */
async function freshService(page: Page): Promise<string> {
  const response = await page.request.get('/api/v1/pipelines/applications?limit=100');
  const { items } = (await response.json()) as { items: Array<{ key: string }> };
  const used = new Set([
    'checkout-api',
    'market-money',
    'market-orders',
    'market-web',
    'pricing-svc',
  ]);
  for (const { key } of items) {
    if (used.has(key)) continue;
    const setup = await page.request.get(`/api/v1/pipelines/applications/${key}/pipeline-setup`);
    if (setup.ok() && ((await setup.json()) as { start: string | null }).start === null) return key;
  }
  throw new Error('No seeded service is free to set up');
}

test('set up a pipeline from a template, add a trigger and a step, and save', async ({
  browser,
}, info) => {
  const page = await openPipelines(browser, '/platform/templates');
  await expectLoaded(page);

  // The built-in templates, the path one suggested, each a starting point.
  await expect(
    page.getByRole('heading', { name: 'Dev, then Stage, then Production' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy and edit' })).toHaveCount(4);
  await page.getByRole('button', { name: 'Copy and edit' }).first().click();
  const copy = page.getByRole('dialog', { name: /Copy Dev, then Stage/ });
  await expect(copy.getByText('test:')).toBeVisible();
  await copy.getByRole('button', { name: 'Close' }).last().click();

  const service = await freshService(page);
  await page.goto(`/pipelines/services/${service}/pipelines`);
  await expect(
    page.getByRole('heading', { name: `Set up a pipeline for ${service}` }),
  ).toBeVisible();
  const create = page.getByRole('button', { name: 'Create pipeline' });
  await expect(create).toBeDisabled();
  await page.getByRole('button', { name: 'Use suggested' }).click();
  await expect(
    page.getByRole('radio', { name: /Dev, then Stage, then Production/ }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(create).toBeEnabled();
  await page.screenshot({ path: info.outputPath('pipeline-setup-light.png'), fullPage: true });
  await create.click();

  // A finished step may return to the setup checklist; the editor is on the service's tab.
  await page.goto(`/pipelines/services/${service}/pipelines`);
  await expect(page.getByRole('heading', { name: 'Deliver' })).toBeVisible();
  await expect(
    page.getByText('No triggers: it runs when someone presses Run').first(),
  ).toBeVisible();
  await expect(page.getByRole('group', { name: 'Steps of the Deliver pipeline' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Unit tests/ })).toBeVisible();

  await page.getByRole('button', { name: 'Add trigger' }).click();
  const trigger = page.getByRole('dialog', { name: 'Add a trigger' });
  await trigger.getByRole('button', { name: 'Add trigger' }).click();
  await expect(page.getByText('On push to main')).toBeVisible();

  await page.getByRole('button', { name: 'Add step' }).first().click();
  await page.getByRole('button', { name: /^Run a script/ }).click();
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Run a script');
  await page.getByRole('radio', { name: 'YAML' }).click();
  await expect(page.getByText('branch: main')).toBeVisible();
  await page.getByRole('radio', { name: 'Visual' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved the pipeline')).toBeVisible();

  const stored = await page.request.get(`/api/v1/pipelines/applications/${service}/pipeline-setup`);
  expect(await stored.json()).toMatchObject({
    start: 'template',
    template: 'dev-stage-production',
    store: 'bemmoly',
    versionScheme: 'semver_commits',
    triggers: [{ kind: 'push', branch: 'main' }],
  });
  await page.keyboard.press('t');
  await page.waitForTimeout(600);
  await page.screenshot({ path: info.outputPath('pipeline-editor-dark.png'), fullPage: true });

  // Run it by hand at a commit: the run's graph is grouped by environment.
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  const run = page.getByRole('dialog', { name: 'Run a pipeline' });
  await run.getByRole('textbox', { name: 'Commit' }).fill('e'.repeat(40));
  await run.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page).toHaveURL(/\/pipelines\/runs\/[0-9a-f-]+/);
  const graph = page.getByRole('group', { name: 'Stages' });
  await expect(graph.getByRole('group', { name: 'Build' })).toBeVisible();
  await expect(graph.getByRole('group', { name: 'Dev' })).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: info.outputPath('run-by-environment.png'), fullPage: true });
  await page.keyboard.press('t');
  await page.waitForTimeout(600);
  await page.screenshot({ path: info.outputPath('run-by-environment-other-mode.png') });

  // Runs: a pipeline runs by hand from the dialog.
  await page.goto('/pipelines/runs');
  await page.getByRole('button', { name: 'Run a pipeline' }).click();
  const dialog = page.getByRole('dialog', { name: 'Run a pipeline' });
  await expect(dialog.getByRole('combobox', { name: 'Service' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expectLoaded(page);
});

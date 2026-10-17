import { expect, test } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';

/*
 * Walkthrough step 2: Run pipeline… on checkout-api, whose demo pipeline really runs on the
 * local runner the setup started. The first unit shard fails on its first attempt (the demo's
 * "flaky" input), the log streams while it runs, and Re-run failed makes the run pass.
 */

test('run a pipeline on the laptop runner, watch it fail, re-run what failed', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const page = await openPipelines(browser, '/applications/checkout-api');
  await expectLoaded(page);
  await page.getByRole('button', { name: /^Run( R)?$/ }).click();
  const dialog = page.getByRole('dialog', { name: "Run checkout-api's pipeline" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Run pipeline' }).click();
  await expect(page).toHaveURL(/\/pipelines\/runs\/[0-9a-f-]+/);
  const runUrl = page.url();

  // The build step's own output, streamed from the runner while the job runs.
  await expect(page.getByText('Compiling 214 modules').first()).toBeVisible({ timeout: 60_000 });

  // The first shard fails on its first attempt with the test that timed out.
  await expect(page.getByText(/retries a timed-out UPI collect/).first()).toBeVisible({
    timeout: 90_000,
  });
  const rerun = page.getByRole('button', { name: 'Re-run failed' });
  await expect(rerun).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await rerun.click();
  // The re-run is the same run, now on its second attempt of what failed; it passes.
  await expect(page).toHaveURL(runUrl);
  await expect(page.getByRole('button', { name: /Re-run failed/ })).toHaveCount(0, {
    timeout: 150_000,
  });
  const id = runUrl.split('/runs/')[1]?.split('?')[0];
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`/api/v1/pipelines/runs/${id}`);
        return ((await response.json()) as { state: string }).state;
      },
      { timeout: 150_000 },
    )
    .toBe('passed');
  await expectLoaded(page);
});

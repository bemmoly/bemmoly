import { expect, test } from '@playwright/test';
import { openPipelines } from '../support/pipelines.ts';
import { readState } from '../support/state.ts';

/*
 * Walkthrough step 5, access: Sam may use Pipelines (the module is granted to everyone) and is
 * a Viewer, so running checkout-api's pipeline is refused with a sentence and who to ask.
 * The checker in Platform › Access explains the same decision.
 */

test('a person without the role is refused with a reason and who to ask', async ({ browser }) => {
  const state = readState();
  const { member } = state;
  // Nobody has a Pipelines role until given one: the admin makes Sam a Viewer.
  const admin = await openPipelines(browser, '/platform/people');
  const given = await admin.request.put(`/api/v1/pipelines/people/${member.id}`, {
    data: { role: 'viewer' },
    headers: { origin: state.baseURL },
  });
  expect(given.ok()).toBe(true);
  const page = await openPipelines(browser, '/applications/checkout-api', member);
  await expect(page.getByRole('heading', { name: 'checkout-api' })).toBeVisible();
  await page.getByRole('button', { name: /^Run( R)?$/ }).click();
  const dialog = page.getByRole('dialog', { name: "Run checkout-api's pipeline" });
  await dialog.getByRole('button', { name: 'Run pipeline' }).click();
  const refusal = dialog.getByRole('status');
  await expect(refusal).toBeVisible();
  await expect(refusal).not.toContainText('Check your connection');
  await expect(refusal).toContainText(/Ask /);
});

test('the checker explains the decision and every rule behind it', async ({ browser }) => {
  const { member } = readState();
  const page = await openPipelines(
    browser,
    `/platform/access?who=${member.id}&action=run&app=checkout-api`,
  );
  await expect(page.getByText('Not allowed')).toBeVisible();
  await expect(page.getByText('How this was decided')).toBeVisible();

  // The owning team's Maintainers may: the same question for the first admin's team.
  await page.goto('/pipelines/platform/access?action=view&app=checkout-api');
  await expect(page.getByText('Allowed', { exact: true })).toBeVisible();
});

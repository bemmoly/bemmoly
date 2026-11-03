import { expect, test } from '@playwright/test';
import { openPipelines } from '../support/pipelines.ts';
import { readState } from '../support/state.ts';

/*
 * Roles decide what you see. The first admin is a Platform admin; the member has no role
 * until given one. Platform › People and roles makes an approval group, makes the member an
 * Approver in it, and the member's rail then shows For you and Changes only, with "Not part
 * of your view" anywhere else. The member is left a Viewer for the walkthrough after this.
 */

const GROUP = 'Release approvers';

test('people and roles: an approval group, an Approver and what they see', async ({ browser }) => {
  const state = readState();
  const { member } = state;
  const page = await openPipelines(browser, '/platform/people');

  for (const role of ['Platform admin', 'Developer', 'Approver', 'Viewer']) {
    await expect(
      page.getByRole('list', { name: 'The four roles' }).getByText(role, { exact: true }),
    ).toBeVisible();
  }
  const people = page.getByRole('table', { name: 'People' });
  await expect(people.getByText(state.admin.name)).toBeVisible();
  await expect(people.getByText('You', { exact: true })).toBeVisible();

  // Give the member a role first: only people with a role join a group.
  const given = await page.request.put(`/api/v1/pipelines/people/${member.id}`, {
    data: { role: 'developer' },
    headers: { origin: state.baseURL },
  });
  expect(given.ok()).toBe(true);
  await page.reload();
  await page.getByRole('combobox', { name: `Role of ${member.name}` }).click();
  await page.getByRole('option', { name: /^Approver/ }).click();
  await expect(page.getByText(`${member.name} is now Approver`)).toBeVisible();

  await page.getByRole('button', { name: 'New group' }).click();
  const dialog = page.getByRole('dialog', { name: 'New approval group' });
  await dialog.getByLabel('Name').fill(GROUP);
  await dialog.getByRole('combobox', { name: 'People' }).click();
  await page.getByRole('option', { name: new RegExp(member.name) }).click();
  await dialog.getByRole('button', { name: 'Make the group' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(GROUP, { exact: true }).first()).toBeVisible();
  await expect(people.getByText(GROUP)).toBeVisible();

  const approver = await openPipelines(browser, '/', member);
  const rail = approver.getByRole('navigation', { name: 'Pipelines' }).first();
  await expect(rail.getByRole('link', { name: /Changes/ })).toBeVisible();
  await expect(rail.getByRole('link', { name: /Services/ })).toHaveCount(0);
  await expect(rail.getByRole('link', { name: /Platform/ })).toHaveCount(0);
  await approver.goto('/pipelines/environments');
  await expect(approver.getByRole('heading', { name: 'Not part of your view' })).toBeVisible();
  await expect(approver.getByText(/Environments is for Platform admins/)).toBeVisible();
  await approver.getByRole('button', { name: 'Back to For you' }).click();
  await expect(approver).toHaveURL(/\/pipelines\/?$/);
  await expect(approver.getByRole('button', { name: `${member.name}, Approver` })).toBeVisible();

  // Clean up: the group goes, and the member stays a Viewer.
  const groups = await page.request.get('/api/v1/pipelines/approval-groups');
  const made = ((await groups.json()) as { items: { id: string; name: string }[] }).items.find(
    (group) => group.name === GROUP,
  );
  const removed = await page.request.delete(`/api/v1/pipelines/approval-groups/${made?.id}`, {
    headers: { origin: state.baseURL },
  });
  expect(removed.ok()).toBe(true);
  const viewer = await page.request.put(`/api/v1/pipelines/people/${member.id}`, {
    data: { role: 'viewer' },
    headers: { origin: state.baseURL },
  });
  expect(viewer.ok()).toBe(true);
});

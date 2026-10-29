import { expect, test, uniqueKey } from '../support/fixtures.ts';

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

test('the start page lists what needs me, and the switcher moves between products', async ({
  admin,
  run,
  pageAs,
}) => {
  const project = await admin.createProject({ key: uniqueKey('STA'), name: 'Start flow' });
  await admin.addMembers(project.key, [run.member.id]);
  const typeId = await admin.typeId(project.key);
  const due = await admin.createIssue({
    projectId: project.id,
    typeId,
    title: 'Rotate the signing keys',
    assigneeId: run.member.id,
  });
  await admin.call('PATCH', `/work/issues/${due.key}`, { dueAt: tomorrow() });

  const page = await pageAs(run.member);
  await page.goto('/start');
  const needs = page.getByRole('region', { name: 'Needs you' });
  const row = needs.getByRole('link', { name: new RegExp(`${due.key}.*Rotate the signing keys`) });
  await expect(row).toBeVisible();
  await expect(page.getByTestId('start-product-work')).toContainText('assigned to you');

  await page.getByTestId('product-switcher').click();
  await page.getByRole('menuitemradio', { name: /Docs/ }).click();
  await expect(page).toHaveURL(/\/docs/);
  await page.getByTestId('product-switcher').click();
  await page.getByRole('menuitemradio', { name: /Start page/ }).click();
  await expect(page).toHaveURL(/\/start$/);

  await row.click();
  await expect(page).toHaveURL(new RegExp(`/work/issue/${due.key}$`));
});

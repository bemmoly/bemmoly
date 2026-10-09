import { expect, test, uniqueKey } from '../support/fixtures.ts';

test('⌘K finds an issue by its key and opens it', async ({ page, admin }) => {
  const project = await admin.createProject({ key: uniqueKey('FND'), name: 'Find flow' });
  await admin.createIssues(project, ['Archive old invoices', 'Export the ledger']);
  const key = `${project.key}-2`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /, Rohan$/ })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await palette.getByRole('combobox').fill(key);
  const results = palette.getByRole('listbox', { name: 'Results' });
  const hit = results.getByRole('option', { name: new RegExp(`^${key} Export the ledger`) });
  await expect(hit).toBeVisible();
  await expect(results.getByRole('option', { name: /Archive old invoices/ })).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/work/issue/${key}$`));
  await expect(page.getByRole('heading', { name: 'Export the ledger' })).toBeVisible();

  // A word from the title finds it too.
  await page.keyboard.press('ControlOrMeta+k');
  await palette.getByRole('combobox').fill('ledger');
  await expect(results.getByRole('option', { name: new RegExp(`^${key} `) })).toBeVisible();
});

test('Home lists my work: assigned to me, reported by me and watching', async ({
  admin,
  run,
  pageAs,
  apiFor,
}) => {
  const project = await admin.createProject({ key: uniqueKey('HOM'), name: 'Home flow' });
  await admin.addMembers(project.key, [run.member.id]);
  const typeId = await admin.typeId(project.key);
  const assigned = await admin.createIssue({
    projectId: project.id,
    typeId,
    title: 'Renew the TLS certificates',
    assigneeId: run.member.id,
  });
  const sam = await apiFor(run.member);
  const reported = await sam.createIssue({ projectId: project.id, typeId, title: 'Slow search' });
  const watched = await admin.createIssue({ projectId: project.id, typeId, title: 'Billing v2' });
  await sam.call('PUT', `/work/issues/${watched.key}/watchers`, { watching: true });

  const page = await pageAs(run.member);
  await page.goto('/');
  const tabs = page.getByRole('tablist', { name: 'My work' });
  const row = (key: string) => page.getByRole('link', { name: new RegExp(`${key}`) });

  await expect(tabs.getByRole('tab', { name: /^Assigned to me/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(row(assigned.key)).toBeVisible();
  await expect(row(reported.key)).toHaveCount(0);

  await tabs.getByRole('tab', { name: /^Reported by me/ }).click();
  await expect(row(reported.key)).toBeVisible();
  await expect(row(assigned.key)).toHaveCount(0);

  // Watching holds what Sam follows without being its reporter or assignee.
  await tabs.getByRole('tab', { name: /^Watching/ }).click();
  await expect(row(watched.key)).toBeVisible();
  await expect(row(reported.key)).toHaveCount(0);

  await row(watched.key).click();
  await expect(page).toHaveURL(new RegExp(`/work/issue/${watched.key}$`));
  await expect(page.getByRole('heading', { name: 'Billing v2' })).toBeVisible();
});

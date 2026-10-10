import { expect, test, uniqueKey } from '../support/fixtures.ts';

interface Member {
  userId: string;
  roleKey: string;
}

test('a project is created with an owning team and its creator leads it', async ({
  page,
  admin,
  run,
  me,
}) => {
  const key = uniqueKey('PRJ');
  const name = `Payments ${key}`;
  await page.goto('/work/projects');
  await page.getByRole('button', { name: 'New project' }).click();

  const dialog = page.getByRole('dialog', { name: 'Create project' });
  await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
  await dialog.getByRole('textbox', { name: 'Key' }).fill(key);
  await dialog.getByRole('radio', { name: /^Kanban/ }).check();
  await dialog.getByRole('combobox', { name: 'Team' }).click();
  await page.getByRole('option', { name: run.team.name }).click();
  await expect(dialog.getByRole('combobox', { name: 'Team' })).toHaveText(run.team.name);
  await expect(dialog.getByText(`Lead: ${run.admin.name}, the team's lead`)).toBeVisible();
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect(dialog).toBeHidden();

  await page.goto('/work/projects');
  const row = page.getByRole('row', { name: new RegExp(`^${key} `) });
  await expect(row.getByRole('cell').nth(1)).toHaveText(name);
  await expect(row.getByRole('cell').nth(2)).toHaveText('Kanban');
  await expect(row.getByRole('cell').nth(3)).toHaveText(run.team.name);

  const project = await admin.call<{ teamId: string; method: string }>(
    'GET',
    `/work/projects/${key}`,
  );
  expect(project).toMatchObject({ teamId: run.team.id, method: 'kanban' });
  const { items } = await admin.call<{ items: Member[] }>('GET', `/work/projects/${key}/members`);
  expect(items).toContainEqual(
    expect.objectContaining({ userId: me.id, roleKey: 'project_admin' }),
  );
});

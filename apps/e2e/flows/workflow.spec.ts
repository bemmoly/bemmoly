import { expect, test, uniqueKey } from '../support/fixtures.ts';

interface Transition {
  toStatusName: string;
}

test('a workflow change published in the editor is what the board follows', async ({
  page,
  admin,
}) => {
  const project = await admin.createProject({
    key: uniqueKey('WFL'),
    name: 'Workflow flow',
    method: 'kanban',
  });
  // The project's own copy, so publishing changes no other project's workflow.
  await admin.call('POST', `/work/projects/${project.key}/schemes/workflow/override`);
  const [issue] = await admin.createIssues(project, ['Rotate the signing keys']);
  if (!issue) throw new Error('no issue');
  await admin.walk(issue.key, ['Selected', 'In progress']);
  const targets = async () =>
    (
      await admin.call<{ items: Transition[] }>('GET', `/work/issues/${issue.key}/transitions`)
    ).items.map((item) => item.toStatusName);
  expect(await targets()).not.toContain('Testing');

  await page.goto(`/work/workflows/${project.key}`);
  await page
    .getByRole('row', { name: /PROJECT COPY/ })
    .getByRole('cell')
    .first()
    .click();
  await expect(page.getByText('No unpublished changes')).toBeVisible();

  // In progress → Testing, for work that needs no review.
  await page.getByRole('button', { name: /^In progress In progress/ }).click();
  await page.getByRole('button', { name: 'Add transition' }).click();
  await page.getByRole('combobox', { name: 'Add transition to' }).click();
  await page.getByRole('option', { name: 'Testing' }).click();
  await expect(page.getByText('No unpublished changes')).toBeHidden();
  await expect(page.getByText('Draft saved')).toBeVisible();

  await page.getByRole('button', { name: 'Publish' }).click();
  const publish = page.getByRole('dialog', { name: /^Publish .* version 2\?$/ });
  await publish.getByRole('button', { name: 'Publish version 2' }).click();
  await expect(publish).toBeHidden();
  await expect(page.getByText('Version 2 published')).toBeVisible();
  expect(await targets()).toContain('Testing');

  // The board takes the new transition the workflow just gained.
  await page.goto(`/work/board/${project.key}`);
  const column = (name: string) => page.getByRole('group', { name: `${name}, All issues` });
  const card = column('In progress').getByRole('button', { name: new RegExp(`^${issue.key} `) });
  await card.dragTo(column('Testing'));
  await expect(column('Testing').getByRole('button', { name: issue.key })).toBeVisible();
  await expect.poll(async () => (await targets()).includes('Done')).toBe(true);
  await page.reload();
  await expect(column('Testing').getByRole('button', { name: issue.key })).toBeVisible();
});

import { expect, test, uniqueKey } from '../support/fixtures.ts';

interface Comment {
  bodyText: string;
}

test('a rule built in project settings runs when an issue is created', async ({ page, admin }) => {
  const project = await admin.createProject({ key: uniqueKey('AUT'), name: 'Automation flow' });

  await page.goto(`/work/settings/${project.key}/automation`);
  await page.getByRole('button', { name: 'New rule' }).first().click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Welcome new issues');
  await page.getByRole('combobox', { name: 'Trigger' }).click();
  await page.getByRole('option', { name: 'Issue created' }).click();
  await page.getByRole('button', { name: 'Add action' }).click();
  await page.getByRole('menuitem', { name: 'Add a comment' }).click();
  await page.getByRole('textbox', { name: 'Comment' }).fill('Thanks, we will triage this today.');
  await page.getByRole('checkbox', { name: /Turn on when saved/ }).check();
  await page.getByRole('button', { name: 'Save rule' }).click();

  const rules = page.getByRole('table', { name: 'Project rules' });
  await expect(rules.getByRole('row', { name: /Welcome new issues/ })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Turn Welcome new issues off' })).toBeChecked();

  // Someone files an issue; the rule's comment lands on it through the job queue.
  const [issue] = await admin.createIssues(project, ['Search returns nothing for accents']);
  if (!issue) throw new Error('no issue');
  await expect
    .poll(
      async () =>
        (
          await admin.call<{ items: Comment[] }>('GET', `/work/issues/${issue.key}/comments`)
        ).items.map((comment) => comment.bodyText),
      { timeout: 30_000 },
    )
    .toEqual(['Thanks, we will triage this today.']);

  await page.getByRole('radio', { name: 'Run log' }).click();
  const run = page.getByRole('table', { name: 'Run log' }).getByRole('row', {
    name: new RegExp(issue.key),
  });
  await expect(run).toBeVisible();
  await expect(run).toContainText('Succeeded');

  await page.goto(`/work/issue/${issue.key}`);
  await expect(page.getByText('Thanks, we will triage this today.')).toBeVisible();
});

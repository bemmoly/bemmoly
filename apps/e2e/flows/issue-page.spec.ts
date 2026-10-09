import { expect, test, uniqueKey } from '../support/fixtures.ts';

interface Notification {
  kind?: string;
  title?: string;
  body?: string | null;
}

const json = (value: unknown) => JSON.stringify(value);

test('the issue page saves a rich description with a mention, a comment and a reaction', async ({
  page,
  admin,
  run,
  me,
  apiFor,
}) => {
  const project = await admin.createProject({ key: uniqueKey('ISU'), name: 'Issue flow' });
  await admin.addMembers(project.key, [run.member.id]);
  const [issue] = await admin.createIssues(project, ['Rate limit the exports']);
  if (!issue) throw new Error('no issue');

  await page.goto(`/work/issue/${issue.key}`);
  await expect(page.getByRole('heading', { name: 'Rate limit the exports' })).toBeVisible();
  await expect(page.getByText(`${me.name} created the issue`)).toBeVisible();

  // Description: plain words, a bold one, and a mention picked from the people list.
  await page.getByRole('button', { name: 'Add description…' }).click();
  const editor = page.getByRole('textbox', { name: 'Description' });
  await editor.click();
  await page.keyboard.type('Exports must be ');
  await page.getByRole('button', { name: 'Bold' }).click();
  await page.keyboard.type('throttled');
  await page.getByRole('button', { name: 'Bold' }).click();
  await page.keyboard.type(' per person. Ask @Sam');
  await page
    .getByRole('listbox', { name: 'People' })
    .getByRole('option', { name: /Sam R\./ })
    .click();
  await page.keyboard.type('to review.');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText(/Exports must be/)).toBeVisible();
  await expect(page.locator('strong', { hasText: 'throttled' })).toBeVisible();
  await expect(page.locator(`[data-type="mention"][data-id="${run.member.id}"]`)).toBeVisible();

  // Comment, then react to it.
  await page.getByRole('button', { name: /^Add a comment/ }).click();
  await expect(page.getByRole('textbox', { name: 'Comment' })).toBeFocused();
  await page.keyboard.type('Throttling at 10 a minute should do.');
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  const comment = page.getByRole('article').filter({ hasText: 'Throttling at 10 a minute' });
  await expect(comment).toBeVisible();
  await comment.getByRole('button', { name: 'React' }).click();
  await page.getByRole('menuitem', { name: 'React with 👍' }).click();
  await expect(comment.getByRole('button', { name: '👍 1, yours' })).toBeVisible();

  // The round trip: a reload reads all of it back from the server.
  await page.reload();
  await expect(page.locator('strong', { hasText: 'throttled' })).toBeVisible();
  await expect(page.locator(`[data-type="mention"][data-id="${run.member.id}"]`)).toBeVisible();
  await expect(comment.getByRole('button', { name: '👍 1, yours' })).toBeVisible();
  const stored = await admin.call<{ description: unknown }>('GET', `/work/issues/${issue.key}`);
  expect(json(stored.description)).toContain(run.member.id);
  expect(json(stored.description)).toContain('"bold"');

  // Sam hears about the mention.
  const sam = await apiFor(run.member);
  await expect
    .poll(async () => {
      const { items } = await sam.call<{ items: Notification[] }>('GET', '/notifications');
      return json(items);
    })
    .toContain(issue.key);
});

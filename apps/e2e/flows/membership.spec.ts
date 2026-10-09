import type { Page } from '@playwright/test';
import { expect, test, uniqueKey } from '../support/fixtures.ts';

/** The palette's results for a query, as the person on this page sees them. */
async function paletteResults(page: Page, query: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await palette.getByRole('combobox').fill(query);
  return palette.getByRole('listbox', { name: 'Results' });
}

test('a project stays out of sight for a non-member until they are added', async ({
  page,
  admin,
  run,
  me,
  pageAs,
  apiFor,
}) => {
  const project = await admin.createProject({
    key: uniqueKey('MBR'),
    name: 'Membership flow',
    method: 'kanban',
    teamId: run.team.id,
  });
  const [issue] = await admin.createIssues(project, ['Quarterly access review']);
  if (!issue) throw new Error('no issue');

  // Sam is a workspace member, but not in the project or its team.
  const sam = await pageAs(run.member);
  const samApi = await apiFor(run.member);
  await sam.goto('/work/projects');
  await expect(sam.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await expect(sam.getByRole('row', { name: new RegExp(`^${project.key} `) })).toHaveCount(0);
  await sam.goto(`/work/issue/${issue.key}`);
  await expect(sam.getByText('You are not a member of this project')).toBeVisible();
  await expect(sam.getByRole('heading', { name: 'Quarterly access review' })).toHaveCount(0);
  await sam.goto(`/work/board/${project.key}`);
  await expect(sam.getByText(`There is no project ${project.key} you can see.`)).toBeVisible();
  await expect(await paletteResults(sam, issue.key)).toContainText('Nothing matches.');
  await expect(samApi.call('GET', `/work/issues/${issue.key}`)).rejects.toThrow(/ 40[34] /);

  // The admin adds Sam from the project's Members screen.
  await page.goto(`/work/members/${project.key}`);
  await expect(page.getByRole('row', { name: new RegExp(`^${me.name}`) })).toBeVisible();
  await page.getByRole('button', { name: 'Add people' }).click();
  const dialog = page.getByRole('dialog', { name: `Add people to ${project.name}` });
  await dialog.getByRole('combobox', { name: 'People' }).click();
  await page.keyboard.type('Sam');
  await page.getByRole('option', { name: new RegExp(run.member.name) }).click();
  await dialog.getByRole('button', { name: 'Add to project' }).click();
  await expect(dialog).toBeHidden();
  const added = page.getByRole('row', { name: new RegExp(`^${run.member.name}`) });
  await expect(
    added.getByRole('combobox', { name: `Project role for ${run.member.name}` }),
  ).toHaveText(/Member/);

  // Now Sam sees the project, opens its issue and finds it from the palette.
  await sam.goto('/work/projects');
  await expect(sam.getByRole('row', { name: new RegExp(`^${project.key} `) })).toBeVisible();
  await sam.goto(`/work/board/${project.key}`);
  await expect(sam.getByRole('button', { name: new RegExp(`^${issue.key} `) })).toBeVisible();
  await sam.goto(`/work/issue/${issue.key}`);
  await expect(sam.getByRole('heading', { name: 'Quarterly access review' })).toBeVisible();
  const found = await paletteResults(sam, issue.key);
  await expect(found.getByRole('option', { name: new RegExp(`^${issue.key} `) })).toBeVisible();
});

import type { Page } from '@playwright/test';
import { expect, test, uniqueKey } from '../support/fixtures.ts';

/*
 * Turning Work off and on changes the whole install, so this file runs on its
 * own after the flows (see the projects in playwright.config.ts).
 */
test.describe.configure({ mode: 'serial' });

const workRow = (page: Page) =>
  page.getByRole('table', { name: 'Modules' }).getByRole('row', {
    name: /^Work /,
  });

async function disableWork(page: Page) {
  await page.goto('/settings/modules');
  await workRow(page).getByRole('button', { name: 'Disable Work' }).click();
  const dialog = page.getByRole('dialog', { name: 'Disable Work?' });
  await dialog.getByRole('button', { name: 'Disable Work' }).click();
  await expect(dialog).toBeHidden();
  await expect(workRow(page).getByRole('cell').nth(1)).toHaveText('DISABLED');
}

async function enableWork(page: Page) {
  await page.goto('/settings/modules');
  await workRow(page).getByRole('button', { name: 'Enable Work' }).click();
  const dialog = page.getByRole('dialog', { name: 'Who can use Work?' });
  await dialog.getByRole('radio', { name: /^Everyone/ }).click();
  await dialog.getByRole('button', { name: 'Enable Work' }).click();
  await expect(dialog).toBeHidden();
  await expect(workRow(page).getByRole('cell').nth(1)).toHaveText('ENABLED');
}

const nav = (page: Page) => page.getByRole('banner').getByRole('navigation', { name: 'Main' });

test('Work turns off and on twice from Settings › Modules and keeps its data', async ({
  page,
  admin,
  run,
  pageAs,
  apiFor,
}) => {
  const project = await admin.createProject({
    key: uniqueKey('MOD'),
    name: 'Modules flow',
    method: 'kanban',
  });
  await admin.addMembers(project.key, [run.member.id]);
  const issues = await admin.createIssues(project, ['Keep me', 'Keep me too']);
  const keys = issues.map((issue) => issue.key);
  await admin.call('POST', `/work/issues/${keys[0]}/comments`, {
    body: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Still here' }] }],
    },
  });
  const sam = await pageAs(run.member);
  const samApi = await apiFor(run.member);

  for (const round of [1, 2]) {
    await test.step(`round ${round}: disable`, async () => {
      await disableWork(page);
      for (const viewer of [page, sam]) {
        await viewer.goto('/');
        await expect(viewer.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(nav(viewer).getByRole('link', { name: 'Board' })).toHaveCount(0);
        await expect(nav(viewer).getByRole('link', { name: 'Backlog' })).toHaveCount(0);
      }
      await expect(samApi.call('GET', `/work/issues/${keys[0]}`)).rejects.toThrow(/ 40[34] /);
      await sam.goto(`/work/board/${project.key}`);
      await expect(sam.getByRole('button', { name: new RegExp(`^${keys[0]} `) })).toHaveCount(0);
    });

    await test.step(`round ${round}: enable`, async () => {
      await enableWork(page);
      for (const viewer of [page, sam]) {
        await viewer.goto('/');
        await expect(nav(viewer).getByRole('link', { name: 'Board' })).toBeVisible();
      }
      // Everything written before is back: the issues, their comment, and the key counter.
      await sam.goto(`/work/board/${project.key}`);
      for (const key of keys) {
        await expect(sam.getByRole('button', { name: new RegExp(`^${key} `) })).toBeVisible();
      }
      await sam.goto(`/work/issue/${keys[0]}`);
      await expect(sam.getByText('Still here')).toBeVisible();
      const [next] = await admin.createIssues(project, [`Written after round ${round}`]);
      expect(next?.key).toBe(`${project.key}-${2 + round}`);
    });
  }
});

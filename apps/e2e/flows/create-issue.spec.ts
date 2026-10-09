import type { Page } from '@playwright/test';
import { expect, test, uniqueKey } from '../support/fixtures.ts';

async function openCreateForm(page: Page, projectName: string) {
  await page.getByRole('banner').getByRole('button', { name: 'Create' }).click();
  await page.getByRole('menuitem', { name: /^Issue/ }).click();
  const form = page.getByRole('dialog', { name: 'Create issue' });
  await form.getByRole('combobox', { name: 'Project' }).click();
  await page.getByRole('option', { name: projectName }).click();
  return form;
}

test('an issue created through the form gets the next gap-free key', async ({ page, admin }) => {
  const project = await admin.createProject({ key: uniqueKey('CRT'), name: 'Create flow' });
  await page.goto(`/work/board/${project.key}`);

  const form = await openCreateForm(page, project.name);
  await expect(form.getByRole('combobox', { name: 'Issue type' })).toContainText('Story');
  await form.getByRole('textbox', { name: 'Title' }).fill('Let people pay by card');
  await form.getByRole('textbox', { name: 'Description' }).fill('Card payments at checkout.');
  await form.getByRole('spinbutton', { name: 'Story points' }).fill('3');

  // A story needs acceptance criteria: the form says so, and no number is used up.
  await form.getByRole('button', { name: 'Create issue' }).click();
  await expect(form.getByText('Acceptance criteria is required.')).toBeVisible();
  await expect(form).toBeVisible();

  await form.getByRole('textbox', { name: 'Acceptance criteria' }).fill('- A card payment settles');
  await form.getByRole('button', { name: 'Create issue' }).click();
  await expect(form).toBeHidden();
  // The toast names the new key and the new issue opens.
  const first = `${project.key}-1`;
  await expect(page.getByRole('status').filter({ hasText: first })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/work/issue/${first}$`));
  await expect(page.getByRole('heading', { name: 'Let people pay by card' })).toBeVisible();

  const second = await openCreateForm(page, project.name);
  await second.getByRole('combobox', { name: 'Issue type' }).click();
  await page.getByRole('option', { name: 'Task' }).click();
  await second.getByRole('textbox', { name: 'Title' }).fill('Refunds show twice');
  await second.getByRole('button', { name: 'Create issue' }).click();
  await expect(second).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/work/issue/${project.key}-2$`));

  const created = await admin.issue(first);
  expect(created).toMatchObject({ title: 'Let people pay by card', estimate: 3, number: 1 });
  expect((await admin.issue(`${project.key}-2`)).number).toBe(2);
});

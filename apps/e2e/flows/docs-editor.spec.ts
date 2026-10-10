import { arrangePage, body, openLive, saveLine, settled } from '../support/docs.ts';
import { expect, test, uniqueKey } from '../support/fixtures.ts';

const SECTIONS = ['Context', 'Migration order', 'Rollback', 'Open questions'];

test('a page is written, kept, renamed, read by its outline, reviewed and published', async ({
  page,
  admin,
  run,
  me,
}) => {
  const doc = await arrangePage(admin, uniqueKey('E'), 'Session store RFC');
  const reviewer = run.admins.find((person) => person.id !== me.id) ?? run.member;

  // Write it: headings through the Markdown shortcut, a paragraph under each.
  await openLive(page, doc.id);
  await body(page).click();
  // Lines go in as one input each, as a paste would: the collab socket's budget is for people.
  for (const section of SECTIONS) {
    await page.keyboard.type('## ');
    await page.keyboard.insertText(section);
    await page.keyboard.press('Enter');
    for (let line = 0; line < 6; line += 1) {
      await page.keyboard.insertText(
        `${section} detail ${line + 1} keeps the page long enough to scroll.`,
      );
      await page.keyboard.press('Enter');
    }
  }
  await settled(page);
  await expect(body(page).getByRole('heading', { name: 'Rollback' })).toBeVisible();

  // It is still there after a reload.
  await page.reload();
  await expect(saveLine(page)).toHaveAttribute('data-save-state', 'live', { timeout: 20_000 });
  await expect(body(page)).toContainText('Rollback detail 6 keeps the page long enough to scroll.');

  // Rename it from the title; Enter hands the caret to the body.
  const title = page.getByRole('textbox', { name: 'Page title' });
  await title.click();
  await title.fill('Session store RFC v2');
  await title.press('Enter');
  await expect(body(page)).toBeFocused();
  // The frame's header names the page once it has loaded; the doc's own bar does too.
  const trail = page.getByRole('navigation', { name: 'Breadcrumb' }).first();
  await expect(trail).toContainText('Session store RFC v2');
  await expect(
    page.getByRole('tree').getByRole('treeitem', { name: 'Session store RFC v2' }),
  ).toBeVisible();

  // The outline sits in the About panel at this width; it scrolls to a section and marks it.
  const outline = page.getByRole('navigation', { name: 'On this page' });
  await expect(outline.getByRole('link')).toHaveText(SECTIONS);
  await outline.getByRole('link', { name: 'Open questions' }).click();
  await expect(page).toHaveURL(/#open-questions$/);
  await expect(body(page).getByRole('heading', { name: 'Open questions' })).toBeInViewport();
  await expect(outline.getByRole('link', { name: 'Open questions' })).toHaveAttribute(
    'aria-current',
    'location',
  );

  // ⌘S is answered, not ignored.
  await page.keyboard.press('ControlOrMeta+s');
  await expect(page.getByText('Saved automatically')).toBeVisible();

  // Ask for review with a reviewer, then publish.
  await page.getByRole('button', { name: /Change status/ }).click();
  await page.getByRole('menuitem', { name: 'Request review…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reviewers' });
  await dialog.getByRole('checkbox', { name: reviewer.name }).check();
  await dialog.getByRole('button', { name: 'Request review' }).click();
  await expect(page.getByRole('button', { name: /Status: in review/ })).toBeVisible();
  await page.getByRole('button', { name: /Change status/ }).click();
  await page.getByRole('menuitem', { name: 'Publish' }).click();
  await expect(page.getByRole('button', { name: /Status: published/ })).toBeVisible();

  const stored = await admin.call<{ title: string; status: string; reviewers: string[] }>(
    'GET',
    `/docs/pages/${doc.id}`,
  );
  expect(stored).toMatchObject({
    title: 'Session store RFC v2',
    status: 'published',
    reviewers: [reviewer.id],
  });
});

import { arrangePage, body, openLive, saveLine, settled, typeAt } from '../support/docs.ts';
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
  // The frame's one header names the page once it has loaded, and so does its sidebar row.
  const trail = page.getByRole('navigation', { name: 'Breadcrumb' }).first();
  await expect(trail).toContainText('Session store RFC v2');
  await expect(
    page.getByRole('tree').getByRole('treeitem', { name: 'Session store RFC v2' }),
  ).toBeVisible();

  // The outline rests in the margin where it fits and opens over the page where it does
  // not; it scrolls to a section and marks it.
  const outline = page.getByRole('navigation', { name: 'On this page' });
  const showOutline = async () => {
    if (!(await outline.isVisible())) await page.getByRole('button', { name: 'Outline' }).click();
  };
  await showOutline();
  await expect(outline.getByRole('link')).toHaveText(SECTIONS);
  await outline.getByRole('link', { name: 'Open questions' }).click();
  await expect(page).toHaveURL(/#open-questions$/);
  await expect(body(page).getByRole('heading', { name: 'Open questions' })).toBeInViewport();
  await showOutline();
  await expect(outline.getByRole('link', { name: 'Open questions' })).toHaveAttribute(
    'aria-current',
    'location',
  );
  await page.keyboard.press('Escape');

  // ⌘S is answered, not ignored.
  await page.keyboard.press('ControlOrMeta+s');
  await expect(page.getByText('Saved automatically')).toBeVisible();

  // Ask for review with a reviewer, then publish.
  await page
    .getByRole('button', { name: /Change status/ })
    .first()
    .click();
  await page.getByRole('menuitem', { name: 'Request review…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reviewers' });
  await dialog.getByRole('checkbox', { name: reviewer.name }).check();
  await dialog.getByRole('button', { name: 'Request review' }).click();
  await expect(page.getByRole('button', { name: /Status: in review/ })).toBeVisible();
  await page
    .getByRole('button', { name: /Change status/ })
    .first()
    .click();
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

test('a writer formats from the bubble, links with ⌘K and moves blocks from the margin', async ({
  page,
  admin,
}) => {
  const doc = await arrangePage(admin, uniqueKey('E'), 'Writing surface');
  await openLive(page, doc.id);
  await body(page).click();
  await page.keyboard.insertText('Redis stays warm for 7 days');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText('Second line');

  // Select the first line: the bubble offers the marks, and each applies at once.
  // The DOM selection, not Shift+End, which reaches the document's end on macOS.
  await body(page).evaluate((element) => {
    (element as HTMLElement).focus();
    const range = document.createRange();
    range.selectNodeContents(element.querySelector('p')!);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
  });
  const bubble = page.getByRole('toolbar', { name: 'Format' });
  await expect(bubble).toBeVisible();
  await bubble.getByRole('button', { name: 'Bold' }).click();
  await expect(body(page).locator('p strong').first()).toHaveText('Redis stays warm for 7 days');
  await bubble.getByRole('button', { name: 'Highlight' }).click();
  await expect(body(page).locator('p mark').first()).toBeVisible();

  // ⌘K links the selection to an address typed in place.
  await page.keyboard.press('ControlOrMeta+k');
  const field = page.getByRole('combobox', { name: 'Link address or page' });
  await field.fill('example.org/runbook');
  await field.press('Enter');
  await expect(body(page).locator('a[href="https://example.org/runbook"]')).toBeVisible();

  // Alt+Shift+↓ moves the block below its neighbour, once the text has its focus back.
  await expect(body(page)).toBeFocused();
  await page.keyboard.press('Alt+Shift+ArrowDown');
  await expect(body(page).locator('p').first()).toHaveText('Second line');

  // The / menu turns a heading back into text.
  await typeAt(page, '', 0);
  await page.keyboard.press('Enter');
  await page.keyboard.type('## Decision');
  await expect(body(page).getByRole('heading', { name: 'Decision' })).toBeVisible();
  await page.keyboard.press('ArrowLeft', { delay: 0 });
  for (let i = 1; i < 'Decision'.length; i += 1) await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('/text');
  await expect(page.getByRole('listbox', { name: 'Blocks' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(body(page).getByRole('heading', { name: 'Decision' })).toHaveCount(0);

  // The grip's menu deletes a block at once, with Undo.
  await body(page).locator('p').first().hover();
  await page.getByRole('button', { name: /Move or change this paragraph/ }).click();
  await page.getByRole('menuitem', { name: /Delete/ }).click();
  await expect(page.getByText('Block deleted')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(body(page).locator('p').first()).toHaveText('Second line');
  await settled(page);
});

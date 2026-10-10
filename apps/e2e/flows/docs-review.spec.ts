import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { arrangePage, body, docText, openLive, settled, typeAt } from '../support/docs.ts';
import { expect, test, uniqueKey } from '../support/fixtures.ts';

/*
 * Reviewing a page: comment on selected words, reply and resolve; save a version, edit,
 * compare and restore; export the page as Markdown; import Markdown into a space.
 */

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

/** Selects the first occurrence of `words` in the page body, as a person dragging over it. */
async function selectWords(page: Page, words: string) {
  await body(page).evaluate((element, wanted) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent?.indexOf(wanted) ?? -1;
      if (at < 0) continue;
      (element as HTMLElement).focus();
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + wanted.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    throw new Error(`"${wanted}" is not on the page`);
  }, words);
}

/** Writes into a comments-rail box once its editor has loaded. */
async function write(page: Page, box: string, text: string) {
  const field = page.getByRole('textbox', { name: box, exact: true });
  await expect(field).toHaveAttribute('contenteditable', 'true');
  await field.click();
  await page.keyboard.type(text);
}

const panel = (page: Page) => page.getByRole('complementary', { name: 'Page details' });

test('a reader comments on selected words, gets a reply and resolves the thread', async ({
  page,
  admin,
}) => {
  const doc = await arrangePage(admin, uniqueKey('R'), 'Session rollout', {
    type: 'doc',
    content: [para('Sessions stay valid for 15 minutes after cutover.')],
  });
  await openLive(page, doc.id);

  await selectWords(page, '15 minutes');
  await page.getByRole('button', { name: /^Comment/ }).click();
  const draft = panel(page).getByRole('region', { name: 'New comment' });
  await expect(draft).toContainText('15 minutes');
  await write(page, 'Comment', 'The flag TTL in code is 30. Which is it?');
  await draft.getByRole('button', { name: 'Comment', exact: true }).click();

  const thread = panel(page).locator('article', { hasText: 'Which is it?' });
  await expect(thread).toContainText('15 minutes');
  await expect(body(page).locator('[data-comment-id]')).toHaveText('15 minutes');
  await expect(panel(page).getByRole('tab', { name: 'Comments (1)' })).toBeVisible();

  await thread.getByRole('button', { name: 'Reply' }).click();
  await write(page, 'Reply', 'Thirty. Updating the doc.');
  await thread.getByRole('button', { name: 'Reply', exact: true }).click();
  await expect(thread).toContainText('Thirty. Updating the doc.');

  await thread.getByRole('button', { name: 'Resolve' }).click();
  await expect(panel(page).getByText('No open comments')).toBeVisible();
  await expect(body(page).locator('[data-comment-id]')).toHaveCount(0);
  await panel(page).getByRole('radio', { name: 'Resolved' }).click();
  await expect(panel(page).locator('article', { hasText: 'Which is it?' })).toBeVisible();
  await expect(panel(page).getByRole('button', { name: 'Reopen' })).toBeVisible();
});

test('a version is saved, the page edited, the two compared and the version restored', async ({
  page,
  admin,
}) => {
  const doc = await arrangePage(admin, uniqueKey('V'), 'Rollback plan', {
    type: 'doc',
    content: [para('Flip the flag off.')],
  });
  await openLive(page, doc.id);

  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Version history' }).click();
  await panel(page).getByRole('button', { name: 'Save version' }).click();
  await panel(page).getByRole('textbox', { name: 'Version name' }).fill('Before review');
  await panel(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(panel(page).getByText('Before review')).toBeVisible();

  await typeAt(page, ' Then page the on-call.', 0);
  await settled(page);
  await expect
    .poll(
      async () => {
        const list = await admin.call<{ items: { id: string; label: string | null }[] }>(
          'GET',
          `/docs/pages/${doc.id}/revisions`,
        );
        const saved = list.items.find((item) => item.label === 'Before review');
        if (!saved) return 0;
        const compare = await admin.call<{ diff: { stats: { changed: number } } }>(
          'GET',
          `/docs/pages/${doc.id}/revisions/compare?from=${saved.id}&to=current`,
        );
        return compare.diff.stats.changed;
      },
      { timeout: 20_000 },
    )
    .toBe(1);

  // The version just saved is the one picked, with its actions open.
  await expect(panel(page).getByRole('button', { name: /^Before review/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await panel(page).getByRole('button', { name: 'Compare with now' }).click();
  const compare = page.getByRole('dialog', { name: 'Compare versions' });
  await expect(compare.getByText('1 edited')).toBeVisible();
  await expect(compare.locator('ins')).toContainText('page the on-call.');

  await compare.getByRole('button', { name: 'Restore Before review' }).click();
  const confirm = page.getByRole('dialog', { name: 'Restore “Before review”?' });
  await expect(confirm).toContainText('Everyone with the page open sees the change');
  await confirm.getByRole('button', { name: 'Restore', exact: true }).click();

  await expect.poll(() => docText(page), { timeout: 20_000 }).toBe('Flip the flag off.');
  await expect(panel(page).getByText('Restore', { exact: true }).first()).toBeVisible();
});

test('a page exports as Markdown and Markdown imports into a space', async ({ page, admin }) => {
  const key = uniqueKey('X');
  const doc = await arrangePage(admin, key, 'Release checklist', {
    type: 'doc',
    content: [para('Tag, build, verify.')],
  });
  await openLive(page, doc.id);

  await page.getByRole('button', { name: 'More actions' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: /Export as Markdown/ }).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toMatch(/\.md$/);
  const text = await readFile(await file.path(), 'utf8');
  expect(text).toContain('Tag, build, verify.');

  await page.goto(`/docs/s/${key}`);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /^Import into/ });
  await dialog.locator('input[aria-label="Files to import"]').setInputFiles({
    name: 'on-call.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(
      '---\ntitle: On-call handbook\n---\n\nPage the secondary after 10 minutes.\n',
    ),
  });
  await expect(dialog.getByText('on-call.md')).toBeVisible();
  await dialog.getByRole('button', { name: 'Import 1 file' }).click();
  await expect(page).toHaveURL(/\/docs\/p\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('textbox', { name: 'Page title' })).toHaveValue('On-call handbook');
  await expect(page.getByRole('treeitem', { name: 'On-call handbook' })).toBeVisible();
});

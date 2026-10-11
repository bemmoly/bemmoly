import type { Page } from '@playwright/test';
import { arrangePage, body, docText, openLive, settled, typeAt } from '../support/docs.ts';
import {
  GHOST,
  startEditorAiModel,
  WRITTEN,
  type EditorAiModel,
} from '../support/editor-ai-model.ts';
import { expect, test, uniqueKey } from '../support/fixtures.ts';
import type { WorkApi } from '../support/work-api.ts';

/*
 * AI inside the Docs editor on a shared page, two people in two browsers, against the real
 * server and a model server on this machine. With AI off the editor shows no AI at all. With
 * it on, ghost text in one browser never reaches the other until it is accepted, and an
 * accepted suggestion lands for both.
 */

const LINE = 'Sessions move to Postgres';

interface Provider {
  id: string;
  name: string;
  kind: string;
}

/** Points the workspace's AI at the local model, every language role on it, and turns AI on. */
async function aiOn(admin: WorkApi, model: EditorAiModel) {
  const { items } = await admin.call<{ items: Provider[] }>('GET', '/admin/ai/providers');
  let provider = items.find((item) => item.kind === 'custom');
  if (provider) {
    await admin.call('PATCH', `/admin/ai/providers/${provider.id}`, { baseUrl: model.baseURL });
  } else {
    provider = await admin.call<Provider>('POST', '/admin/ai/providers', {
      kind: 'custom',
      protocol: 'openai-compatible',
      name: 'Local server',
      baseUrl: model.baseURL,
      apiKey: 'e2e-local-key',
    });
  }
  for (const role of ['fast', 'standard', 'strong']) {
    await admin.call('PUT', `/admin/ai/roles/${role}`, {
      providerId: provider.id,
      model: 'house-chat-small',
    });
  }
  await admin.call('PATCH', '/admin/ai/settings', {
    privacy: { enabled: true, shareContent: true },
    budget: { monthlyBudgetUsd: null },
  });
}

const aiOff = (admin: WorkApi) =>
  admin.call('PATCH', '/admin/ai/settings', { privacy: { enabled: false } });

const ghost = (page: Page) => page.locator('[data-ghost-text]');

/** Selects `words` in the page body through the DOM, as a drag over them would. */
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
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
      return;
    }
    throw new Error(`"${wanted}" is not on the page`);
  }, words);
}

// AI off first, then on: the two share the install's one AI switch.
test.describe.configure({ mode: 'serial' });

let model: EditorAiModel;
test.beforeAll(async () => {
  model = await startEditorAiModel();
});
test.afterAll(async () => {
  await model.stop();
});

test('with AI off the editor draws no AI group, no Ask AI and no ghost text', async ({
  page,
  admin,
}) => {
  await aiOff(admin);
  const doc = await arrangePage(admin, uniqueKey('N'), 'No AI here', {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: LINE }] }],
  });
  await openLive(page, doc.id);
  await typeAt(page, ' now', 0);
  await page.waitForTimeout(2000);
  await expect(ghost(page)).toHaveCount(0);
  await page.keyboard.press('Enter');
  await page.keyboard.type('/');
  const menu = page.getByRole('listbox', { name: 'Blocks' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('group', { name: 'AI' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await selectWords(page, LINE);
  await expect(page.getByRole('toolbar', { name: 'Format' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask AI' })).toHaveCount(0);
});

test('ghost text stays in one browser until accepted, and a suggestion lands for both', async ({
  page,
  admin,
  pageAs,
  run,
  me,
}) => {
  await aiOn(admin, model);
  const doc = await arrangePage(admin, uniqueKey('G'), 'Session store plan', {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: LINE }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'we moves the reads later' }] },
    ],
  });
  const other = run.admins.find((person) => person.id !== me.id) ?? run.member;
  const theirs = await pageAs(other);
  await Promise.all([openLive(page, doc.id), openLive(theirs, doc.id)]);

  // Ghost text: drawn for the typist only, never in the shared document.
  await typeAt(page, ' now', 0);
  await expect(ghost(page)).toHaveText(new RegExp(GHOST.trim()), { timeout: 10_000 });
  await settled(page);
  await expect.poll(() => docText(theirs)).toContain(`${LINE} now`);
  expect(await docText(theirs)).not.toContain(GHOST.trim());
  await expect(ghost(theirs)).toHaveCount(0);

  // Tab writes it in, and then both have it.
  await page.keyboard.press('Tab');
  await expect(ghost(page)).toHaveCount(0);
  await expect.poll(() => docText(theirs)).toContain(`${LINE} now${GHOST}`);

  // Ask AI over the second line: the card streams beside the text; Replace lands for both.
  await selectWords(page, 'we moves the reads later');
  await page.getByRole('button', { name: 'Ask AI' }).click();
  await page.getByRole('menuitem', { name: 'Improve writing' }).click();
  const card = page.getByRole('region', { name: 'AI improve writing' });
  await expect(card).toContainText(WRITTEN, { timeout: 15_000 });
  expect(await docText(theirs)).not.toContain(WRITTEN);
  await card.getByRole('button', { name: 'Replace' }).click();
  await expect(card).toHaveCount(0);
  await expect.poll(() => docText(theirs)).toContain(WRITTEN);
  await expect.poll(() => docText(page)).not.toContain('we moves the reads later');

  // One undo takes the whole suggestion back, for both.
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => docText(theirs)).toContain('we moves the reads later');
  expect(model.prompts.some((prompt) => prompt.includes('continue a person'))).toBe(true);
  await aiOff(admin);
});

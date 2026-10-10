import { expect, type Page } from '@playwright/test';
import type { WorkApi } from './work-api.ts';

export interface DocsPage {
  id: string;
  spaceKey: string;
  title: string;
}

/** A space of its own and one page in it, made through the API so a flow starts on the page. */
export async function arrangePage(
  api: WorkApi,
  key: string,
  title: string,
  snapshot?: object,
): Promise<DocsPage> {
  const space = await api.call<{ id: string; key: string }>('POST', '/docs/spaces', {
    key,
    name: `Editor ${key}`,
  });
  const page = await api.call<{ id: string }>('POST', '/docs/pages', {
    spaceId: space.id,
    title,
    ...(snapshot ? { snapshot } : {}),
  });
  return { id: page.id, spaceKey: space.key, title };
}

/** The page body's text box. */
export const body = (page: Page) => page.getByRole('textbox', { name: 'Page body' });

/** The header's save line ("Saved · Priya is editing"). */
export const saveLine = (page: Page) => page.locator('[data-save-state]');

/** Opens the page and waits until its live document has synced and takes typing. */
export async function openLive(page: Page, pageId: string): Promise<void> {
  await page.goto(`/docs/p/${pageId}`);
  await expect(saveLine(page)).toHaveAttribute('data-save-state', 'live', { timeout: 20_000 });
  await expect(body(page)).toHaveAttribute('contenteditable', 'true');
}

/** Waits until every local change has reached the server. */
export async function settled(page: Page): Promise<void> {
  await expect(saveLine(page)).toHaveText(/^Saved/, { timeout: 15_000 });
}

/** The document's text, block by block, without the other people's carets and their names. */
export async function docText(page: Page): Promise<string> {
  return body(page).evaluate((element) => {
    const copy = element.cloneNode(true) as HTMLElement;
    for (const caret of copy.querySelectorAll('[data-collab-caret]')) caret.remove();
    return [...copy.children].map((block) => block.textContent ?? '').join('\n');
  });
}

/**
 * Puts the caret at the end of the body's `block`-th paragraph (or of the whole body) and
 * types there, at about a fast typist's pace.
 */
export async function typeAt(page: Page, text: string, block?: number): Promise<void> {
  // The DOM selection, not End keys: they move differently on macOS and Linux.
  await body(page).evaluate((element, index) => {
    const target = index === undefined ? element : element.querySelectorAll('p')[index];
    if (!target) throw new Error(`no paragraph ${String(index)}`);
    (element as HTMLElement).focus();
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, block);
  await page.keyboard.type(text, { delay: 40 });
}

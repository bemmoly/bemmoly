import type { Page } from '@playwright/test';
import { arrangePage, body, openLive, settled } from '../support/docs.ts';
import { expect, test, uniqueKey } from '../support/fixtures.ts';

/** A 1×1 PNG, and the same pixel with a trailing comment so it is a second, distinct file. */
const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** Hands the editor image files the way a paste or a drop from the desktop does. */
async function sendImage(page: Page, how: 'paste' | 'drop', name: string, extra = '') {
  await body(page).evaluate(
    async (element, { how, name, pixel, extra }) => {
      const bytes = Uint8Array.from(atob(pixel), (char) => char.charCodeAt(0));
      const file = new File([bytes, extra], name, { type: 'image/png' });
      const data = new DataTransfer();
      data.items.add(file);
      if (how === 'paste') {
        element.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
        );
        return;
      }
      const last = element.lastElementChild!.getBoundingClientRect();
      element.dispatchEvent(
        new DragEvent('drop', {
          dataTransfer: data,
          clientX: last.left + 4,
          clientY: last.bottom - 2,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { how, name, pixel: PIXEL, extra },
  );
}

const storedImages = (page: Page) => body(page).locator('img[src^="/api/v1/files/"]');

/*
 * Images go into a page by paste and by drop, upload to the kernel's files API, and reach
 * the other person on the page live, as stored URLs (never the bytes) that load for them.
 */
test('a pasted and a dropped image reach the other person on the page', async ({
  page,
  admin,
  pageAs,
  run,
  me,
}) => {
  const doc = await arrangePage(admin, uniqueKey('I'), 'Release diagrams', {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Diagrams below.' }] }],
  });
  const other = run.admins.find((person) => person.id !== me.id) ?? run.member;
  const theirs = await pageAs(other);
  await Promise.all([openLive(page, doc.id), openLive(theirs, doc.id)]);

  await body(page).click();
  await sendImage(page, 'paste', 'Rollout flow.png');
  await expect(storedImages(page)).toHaveCount(1);
  await expect(storedImages(page).first()).toHaveAttribute('alt', 'Rollout flow');

  await sendImage(page, 'drop', 'Cutover.png', 'second');
  await expect(storedImages(page)).toHaveCount(2);
  await settled(page);

  // The other browser gets both, and they load for them (a reader of the page).
  await expect(storedImages(theirs)).toHaveCount(2, { timeout: 15_000 });
  await expect(storedImages(theirs).nth(1)).toHaveAttribute('alt', 'Cutover');
  for (const image of await storedImages(theirs).all()) {
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
  }
  const html = await body(theirs).innerHTML();
  expect(html).not.toContain('data:image');
});

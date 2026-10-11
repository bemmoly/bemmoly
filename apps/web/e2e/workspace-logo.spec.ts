import { crc32, deflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { useMockBackend } from './support/mock-backend.ts';

/** A real, decodable PNG of one colour, so the browser can measure it before sending. */
function solidPng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x3a)]);
  const pixels = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', pixels),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

test('an admin uploads a logo, sees it in the sidebar, rail and sign-in, then removes it with undo', async ({
  page,
}) => {
  const backend = await useMockBackend(page, 'ready');
  await page.goto('/settings/appearance');
  const input = page.locator('input[type="file"][accept*="svg"]');

  // Too small: explained before anything is sent.
  await input.setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: solidPng(64, 64) });
  await expect(page.getByRole('alert')).toContainText('at least 128 × 128');
  expect(backend.api.db.settings['appearance.logoKey']).toBe('');

  await input.setInputFiles({
    name: 'acme.png',
    mimeType: 'image/png',
    buffer: solidPng(256, 256),
  });
  await expect(page.getByRole('button', { name: 'Replace' })).toBeVisible();
  await expect(page.getByTestId('logo-preview-light')).toContainText(/on\s*Bemmoly/);
  expect(backend.api.db.settings['appearance.logoKey']).toMatch(
    /^\/api\/v1\/workspace\/logo\/[0-9a-f]{64}\.png$/,
  );

  // Line one of the sidebar is the logo and name; "on Bemmoly" stays under it.
  await page.goto('/');
  const sidebar = page.getByRole('complementary').first();
  await expect(sidebar.locator('img[src^="data:image/png"]').first()).toBeVisible();
  await expect(sidebar.getByText('on Bemmoly')).toBeVisible();
  await expect(page).toHaveTitle(/· Bemmoly$/);

  // The collapsed rail: the logo at the top, the Bemmoly mark at the foot.
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(page.getByRole('img', { name: 'Acme Labs' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Bemmoly .*What's new$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await page.goto('/settings/appearance');

  // Remove, then Undo puts the same logo back.
  const stored = backend.api.db.settings['appearance.logoKey'];
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('button', { name: 'Upload logo' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Replace' })).toBeVisible();
  expect(backend.api.db.settings['appearance.logoKey']).toBe(stored);

  // Signed out, the sign-in card leads with the logo; Bemmoly is under it.
  await page.getByRole('button', { name: /Account: Rohan S\./ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
  // The sign-in page itself, not Settings on its way out: its banner leads with the logo.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sign in');
  await expect(page.getByRole('banner').locator('img[src^="data:image/png"]')).toBeVisible();
  await expect(page.getByText(/Powered by/)).toBeVisible();
});

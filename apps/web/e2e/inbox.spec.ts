import { expect, test } from '@playwright/test';
import { useMockBackend } from './support/mock-backend.ts';

test('the sidebar counts unread, read-all clears it, and new ones arrive live', async ({
  page,
}) => {
  const backend = await useMockBackend(page, 'ready');
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
  const inbox = sidebar.getByRole('link', { name: /^Inbox/ });
  await expect(inbox).toHaveAccessibleName('Inbox, 4 unread');

  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Mark all read' }).click();
  await expect(inbox).toHaveAccessibleName('Inbox');
  expect(backend.api.db.notifications.filter((item) => !item.done).every((item) => item.read)).toBe(
    true,
  );

  const first = backend.api.db.notifications[0];
  if (!first) throw new Error('seeded notifications missing');
  backend.api.db.notifications.unshift({
    ...first,
    id: 'n-live',
    ids: ['n-live'],
    verb: 'assigned you',
    read: false,
    done: false,
    snoozedUntil: null,
    createdAt: new Date().toISOString(),
  });
  backend.push('notifications', ['n-live']);
  await expect(inbox).toHaveAccessibleName('Inbox, 1 unread');
  await expect(page.getByRole('listbox', { name: 'Notifications' })).toContainText('assigned you');
});

test('triage with the keyboard: J and K move, E marks done with Undo, S snoozes', async ({
  page,
}) => {
  const backend = await useMockBackend(page, 'ready');
  await page.goto('/inbox');
  const list = page.getByRole('listbox', { name: 'Notifications' });
  const rows = list.getByRole('option');
  await expect(rows.first()).toHaveAttribute('aria-selected', 'true');
  const firstText = (await rows.first().textContent()) ?? '';

  await page.keyboard.press('j');
  await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/\?item=/);
  await page.keyboard.press('k');
  await expect(rows.first()).toHaveAttribute('aria-selected', 'true');

  const count = await rows.count();
  await page.keyboard.press('e');
  await expect(rows).toHaveCount(count - 1);
  await expect(page.getByText(/marked done/)).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(rows).toHaveCount(count);
  await expect(list).toContainText(firstText.slice(0, 20));

  await page.keyboard.press('s');
  await expect(rows).toHaveCount(count - 1);
  await expect(page.getByText(/snoozed/)).toBeVisible();
  expect(backend.api.db.notifications.some((item) => item.snoozedUntil)).toBe(true);

  // Mentions only, kept in the address.
  await page.getByRole('radio', { name: 'Mentions' }).click();
  await expect(page).toHaveURL(/filter=mentions/);
  for (const text of await rows.allTextContents()) expect(text).toContain('mentioned you');
});

test('Home’s inbox preview opens the inbox on the item chosen', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/');
  const preview = page.getByRole('region', { name: 'Inbox' });
  await preview
    .getByRole('link', { name: /Priya N\./ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/inbox\?item=/);
  await expect(
    page.getByRole('listbox', { name: 'Notifications' }).getByRole('option', { selected: true }),
  ).toContainText('Priya N.');
});

test('an item shows its issue, opens it, and the issue page walks the Inbox', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/inbox');
  const detail = page.getByRole('article');
  await expect(detail.getByRole('link', { name: /PLT-204/ })).toContainText(
    'Session store migration to Postgres',
  );
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/work\/issue\/PLT-204$/);
  await expect(
    page.getByRole('heading', { name: 'Session store migration to Postgres' }),
  ).toBeVisible();
  await page.keyboard.press('j');
  await expect(page).toHaveURL(/\/work\/issue\/PLT-218$/);
});

test('an issue opened from Home’s My issues steps through that list', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/');
  const rows = page.getByRole('region', { name: 'My issues' }).getByRole('link', { name: /-\d+/ });
  await expect(rows.nth(1)).toBeVisible();
  const second = /[A-Z]+-\d+/.exec((await rows.nth(1).textContent()) ?? '')?.[0] ?? '';
  const title = (await rows.first().locator('span.truncate[title]').getAttribute('title')) ?? '';
  await rows.first().click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await page.keyboard.press('j');
  await expect(page).toHaveURL(new RegExp(`/work/issue/${second}$`));
});

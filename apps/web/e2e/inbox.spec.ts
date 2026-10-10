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

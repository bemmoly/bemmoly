import { expect, test } from '@playwright/test';
import { useMockBackend } from './support/mock-backend.ts';

test('the inbox badge counts unread, read-all clears it, and new ones arrive live', async ({ page }) => {
  const backend = await useMockBackend(page, 'ready');
  await page.goto('/');
  const inbox = page.getByRole('button', { name: /^Inbox/ });
  await expect(inbox).toHaveAccessibleName('Inbox, 4');

  await inbox.click();
  const drawer = page.getByRole('dialog', { name: 'Inbox' });
  await expect(drawer.getByText('requested your review on')).toBeVisible();
  await drawer.getByRole('button', { name: 'Mark all read' }).click();
  await expect(inbox).toHaveAccessibleName('Inbox');
  expect(backend.api.db.notifications.every((item) => item.read)).toBe(true);

  const first = backend.api.db.notifications[0];
  if (!first) throw new Error('seeded notifications missing');
  backend.api.db.notifications.unshift({
    ...first,
    id: 'n-live',
    ids: ['n-live'],
    verb: 'assigned you',
    read: false,
    createdAt: new Date().toISOString(),
  });
  backend.push('notifications', ['n-live']);
  await expect(inbox).toHaveAccessibleName('Inbox, 1');
  await expect(drawer.getByText('assigned you')).toBeVisible();
});

import { expect, test } from '@playwright/test';
import { useMockBackend } from './support/mock-backend.ts';

test('asks the docs from the Docs home and opens the cited heading', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/docs');
  const panel = page.getByRole('region', { name: 'Ask your docs' });
  await expect(panel).toBeVisible();
  await panel
    .getByRole('textbox', { name: 'Question about your docs' })
    .fill('How do we roll back the auth service cutover?');
  await page.keyboard.press('Enter');

  const answer = panel.getByRole('region', { name: 'AI answer' });
  await expect(answer.getByText('by AI · from 2 pages, 1 issue')).toBeVisible();
  await expect(answer.getByText('Unsourced')).toBeVisible();
  await expect(answer.getByRole('button', { name: 'Not useful' })).toBeVisible();

  await answer
    .getByRole('link', { name: /Source 1: RFC: Move sessions to Postgres, Rollback/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/docs\/p\/[0-9a-f-]+#rollback$/);
  await expect(page.getByRole('heading', { name: 'Rollback', level: 2 })).toBeInViewport();
});

test('says so when nothing in the docs answers, and draws nothing with AI off', async ({
  page,
}) => {
  const mock = await useMockBackend(page, 'ready');
  await page.goto('/docs');
  const panel = page.getByRole('region', { name: 'Ask your docs' });
  await panel.getByRole('textbox', { name: 'Question about your docs' }).fill('Who won the cup?');
  await page.keyboard.press('Enter');
  await expect(panel.getByText(/Nothing in your docs answers that yet/)).toBeVisible();

  // An admin turns AI off in Settings › AI.
  mock.api.dispatch('PATCH', 'http://mock.local/api/v1/admin/ai/settings', {
    privacy: { enabled: false },
  });
  await page.goto('/docs');
  await expect(page.getByRole('heading', { name: 'Docs', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ask your docs' })).toHaveCount(0);
});

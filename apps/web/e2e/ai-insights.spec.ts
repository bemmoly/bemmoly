import { expect, test, type Page } from '@playwright/test';
import { aiOf } from '../src/mocks/routes/ai-state.ts';
import { RFC_PAGE_ID } from '../src/mocks/seed/ai-insights.ts';
import { useMockBackend } from './support/mock-backend.ts';

/*
 * The cached AI insights on each surface, against the in-memory backend: each card writes
 * (a skeleton), lands with links to its sources and Not useful, and with AI off nothing AI
 * is drawn at all.
 */

const SLOW = { timeout: 10_000 };

async function noLilac(page: Page) {
  await expect(page.locator('.bg-ai, .bg-ai-50, .text-ai-600, .border-l-ai')).toHaveCount(0);
}

test('Home: the morning brief lands with its sources and steps', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/');
  const brief = page.getByRole('region', { name: 'Your morning brief' });
  await expect(brief).toBeVisible();
  await expect(brief.getByText(/PLT-204 is waiting on your review/)).toBeVisible(SLOW);
  await expect(brief.getByText('by AI · built from 31 updates')).toBeVisible();
  await expect(brief.getByRole('button', { name: 'Review PLT-204' })).toBeVisible();
  await brief.getByRole('button', { name: 'Review PLT-204' }).click();
  await expect(page).toHaveURL(/\/work\/issue\/PLT-204$/);
});

test('Issue: the summary cites its comments, links and doc, and takes Not useful', async ({
  page,
}) => {
  await useMockBackend(page, 'ready');
  await page.goto('/work/issue/PLT-204');
  const summary = page.getByRole('region', { name: 'AI summary' });
  await expect(summary.getByText(/Backfill verified on staging/)).toBeVisible(SLOW);
  await expect(summary.getByText('by AI · from 14 comments, 2 PRs, 1 doc')).toBeVisible();
  await expect(summary.getByRole('link', { name: "Jonas M.'s comment" })).toBeVisible();
  await summary.getByRole('button', { name: 'Not useful' }).click();
  await expect(summary.getByRole('button', { name: 'Marked not useful' })).toBeDisabled();
});

test('Board and Backlog: the sprint risk bar names the risk and can be dismissed', async ({
  page,
}) => {
  await useMockBackend(page, 'ready');
  await page.goto('/work/board');
  const bar = page.getByRole('region', { name: 'Sprint risk' });
  await expect(bar.getByText(/PLT-204 has been in review 3 days/)).toBeVisible(SLOW);
  await bar.getByRole('button', { name: 'Dismiss' }).click();
  await expect(bar).toHaveCount(0);
  await page.getByRole('link', { name: 'Backlog' }).first().click();
  await expect(
    page.getByRole('region', { name: 'Sprint risk' }).getByText(/at current pace/i),
  ).toBeVisible(SLOW);
});

test('Doc: the TL;DR and the consistency finding beside the linked work', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto(`/docs/p/${RFC_PAGE_ID}`);
  const tldr = page.getByRole('region', { name: 'AI tl;dr' });
  await expect(tldr.getByText(/Rollback is a flag flip/)).toBeVisible(SLOW);
  await expect(tldr.getByRole('link', { name: 'Rollback' }).first()).toBeVisible();
  await page.keyboard.press('ControlOrMeta+Alt+l');
  const finding = page.getByRole('region', { name: /Doesn.t match its issues/i });
  await expect(finding.getByText(/stay valid for 15 minutes/)).toBeVisible(SLOW);
  await expect(finding.getByText(/92% sure/)).toBeVisible();
});

test('AI off: no brief, summary, risk bar, TL;DR or finding, and no lilac', async ({ page }) => {
  const backend = await useMockBackend(page, 'ready');
  aiOf(backend.api.db).settings.privacy.enabled = false;
  for (const path of ['/', '/work/issue/PLT-204', '/work/board', `/docs/p/${RFC_PAGE_ID}`]) {
    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
    await page.waitForTimeout(500);
    await noLilac(page);
  }
});

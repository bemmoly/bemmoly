import { expect, type Browser, type Page } from '@playwright/test';
import { readState, type Person } from './state.ts';

/** A page in Pipelines, signed in as this person (the first admin unless named). */
export async function openPipelines(browser: Browser, path = '/', person?: Person): Promise<Page> {
  const state = readState();
  const context = await browser.newContext({
    baseURL: state.baseURL,
    storageState: (person ?? state.admin).storageState,
  });
  const page = await context.newPage();
  await page.goto(`/pipelines${path}`);
  return page;
}

/**
 * Every screen says "… did not load" with Try again when a request fails; the walkthrough
 * fails on any of them, so a missing endpoint never passes as an empty state.
 */
export async function expectLoaded(page: Page): Promise<void> {
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByText(/did not load/i)).toHaveCount(0);
  await expect(page.getByText('This screen is being built')).toHaveCount(0);
}

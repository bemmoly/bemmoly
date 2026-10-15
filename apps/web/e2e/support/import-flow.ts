import { expect, type Page } from '@playwright/test';
import type { MockScenario } from '../../src/mocks/db.ts';
import { findJob } from '../../src/mocks/routes/import-state.ts';
import { useMockBackend as mockBackend, type MockBackend } from './mock-backend.ts';

/*
 * The importer's steps as a person takes them, shared by the import specs, the screenshots and
 * the accessibility audit. The mock picks the site from its address: acme (14 projects), big
 * (1,240, counted lazily), empty (sees nothing), flaky (Mobile apps fails until retried); the
 * token "wrong" is refused.
 */

export type Mode = 'light' | 'dark';

export const VIEWPORTS = {
  1440: { width: 1440, height: 900 },
  390: { width: 390, height: 844 },
} as const;

/** Opens a page on its own mock backend in a mode; the device asks for the same mode. */
export async function openImport(
  page: Page,
  mode: Mode,
  path = '/settings/import',
  scenario: MockScenario = 'ready',
) {
  await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
  const backend = await mockBackend(page, scenario);
  backend.api.db.settings['appearance.defaultMode'] = mode;
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
  return backend;
}

export interface Connection {
  source?: 'Jira' | 'Confluence';
  site?: string;
  token?: string;
}

/** Picks the source and fills the form, without connecting. */
export async function fillConnect(page: Page, connection: Connection = {}) {
  const { source = 'Jira', site = 'https://acme.example.net', token = 'a-token' } = connection;
  await page.getByRole('radio', { name: new RegExp(source) }).click();
  await page.getByLabel('Site address').fill(site);
  await page.getByLabel('Account email').fill('rohan@acmelabs.dev');
  await page.getByLabel('API token').fill(token);
}

export async function connect(page: Page, connection: Connection = {}) {
  await fillConnect(page, connection);
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
}

export const continueWith = (page: Page, n: number) =>
  page.getByRole('button', { name: `Continue with ${n}` });

export const chooserList = (page: Page) => page.getByRole('listbox');

export const option = (page: Page, text: string) =>
  page.getByRole('option').filter({ hasText: text });

/** The chooser has its rows and its count. */
export async function chooserReady(page: Page, selected: number) {
  await expect(chooserList(page)).toBeVisible();
  await expect(continueWith(page, selected)).toBeVisible();
}

export const supKey = (page: Page) => page.getByRole('textbox', { name: 'Key for Support desk' });

/** Connect to acme and continue with the default nine: Options with SUP's key taken. */
export async function toOptions(page: Page, connection: Connection = {}) {
  await connect(page, connection);
  await chooserReady(page, 9);
  await continueWith(page, 9).click();
  await expect(supKey(page)).toHaveAttribute('aria-invalid', 'true');
}

export async function fixSup(page: Page) {
  await supKey(page).fill('SUPD');
  await expect(supKey(page)).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Review import' })).toBeEnabled();
}

export async function toReview(page: Page, connection: Connection = {}) {
  await toOptions(page, connection);
  await fixSup(page);
  await page.getByRole('button', { name: 'Review import' }).click();
  const review = page.getByRole('region', { name: /Review/ });
  await expect(review).toContainText('SUP becomes SUPD');
  return review;
}

export async function start(page: Page, connection: Connection = {}) {
  await toReview(page, connection);
  await page.getByRole('button', { name: 'Start import' }).click();
  await expect(page.getByRole('progressbar', { name: 'Import progress' })).toBeVisible();
}

/** Leaves the next reads of the job unanswered, so the page keeps the run as last read. */
export const freezeRun = (page: Page) =>
  page.route(/\/api\/v1\/admin\/imports\/[\w-]+$/, (route) =>
    route.request().method() === 'GET' ? new Promise<void>(() => undefined) : route.fallback(),
  );

/** Each read of a running job moves it on a third, so a run ends within a few polls. */
export const FINISH = { timeout: 20_000 };

/**
 * Holds a running import where it is: reads of the job answer what the backend has without
 * moving it on, so a step mid-run can be looked at. Release lets it run on.
 */
export async function holdRun(page: Page, backend: MockBackend) {
  let held = true;
  await page.route(/\/api\/v1\/admin\/imports\/[\w-]+$/, async (route) => {
    if (!held || route.request().method() !== 'GET') return route.fallback();
    const id = new URL(route.request().url()).pathname.split('/').pop();
    const job = findJob(backend.api.db, id);
    if (!job) return route.fallback();
    // Let it start and take one step first, so the hold shows a run under way.
    if (job.status === 'queued' || job.progress.done === 0) return route.fallback();
    await route.fulfill({ json: job });
  });
  return {
    release: () => {
      held = false;
    },
  };
}

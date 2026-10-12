import { expect, test, type Page } from '@playwright/test';
import { audit, describe as findings } from './a11y/axe.ts';
import {
  chooserList,
  chooserReady,
  connect,
  continueWith,
  fillConnect,
  FINISH,
  fixSup,
  type Mode,
  openImport,
  option,
  start,
  supKey,
  VIEWPORTS,
} from './support/import-flow.ts';

/*
 * Settings › Import and the setup wizard's short path, end to end on the mock backend, at
 * desktop and phone width, light and dark. Every step is put through axe with every rule on.
 */

async function noViolations(page: Page, step: string) {
  const found = await audit(page);
  const why = found.map((finding) => `${finding.rule}: ${finding.why[0] ?? ''}`);
  expect([...findings(found), ...why], `axe on ${step}`).toEqual([]);
}

/** Rows inside the list's visible box still waiting for their count. */
const countingInView = (page: Page) =>
  page
    .getByRole('option')
    .filter({ has: page.getByRole('img', { name: 'Counting' }) })
    .evaluateAll(
      (rows) =>
        rows.filter((row) => {
          const view = row.closest('[role="listbox"]')?.getBoundingClientRect();
          const box = row.getBoundingClientRect();
          return view && box.bottom > view.top && box.top < view.bottom;
        }).length,
    );

const ticked = (page: Page, text: string) =>
  expect(option(page, text)).toHaveAttribute('aria-selected', 'true');
const unticked = (page: Page, text: string) =>
  expect(option(page, text)).toHaveAttribute('aria-selected', 'false');

for (const width of [1440, 390] as const) {
  for (const mode of ['light', 'dark'] as const satisfies readonly Mode[]) {
    test.describe(`import · ${width} ${mode}`, () => {
      test.use({ viewport: VIEWPORTS[width] });

      test('Jira from Connect to Done', async ({ page }) => {
        await openImport(page, mode);
        await expect(page.getByRole('heading', { level: 1, name: /Import/ })).toBeVisible();
        await fillConnect(page);
        await noViolations(page, 'Connect');

        await page.getByRole('button', { name: 'Connect', exact: true }).click();
        const chooser = page.getByRole('region', { name: /Choose projects/ });
        await expect(chooser).toContainText('acme.example.net · 14 projects this token can see');
        await chooserReady(page, 9);
        await noViolations(page, 'Choose');
        await option(page, 'Mobile apps').click();
        await continueWith(page, 8).click();

        await expect(page.getByRole('region', { name: /What to bring/ })).toBeVisible();
        await expect(supKey(page)).toHaveAttribute('aria-invalid', 'true');
        await expect(
          page.getByText(/SUP is taken by Support Desk \(a Work project\)/),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Review import' })).toBeDisabled();
        await noViolations(page, 'Options with the key clash');
        await fixSup(page);
        await expect(page.getByText('The key becomes SUPD.')).toBeVisible();
        await noViolations(page, 'Options fixed');

        await page.getByRole('button', { name: 'Review import' }).click();
        const review = page.getByRole('region', { name: /Review/ });
        await expect(review).toContainText('SUP becomes SUPD');
        await noViolations(page, 'Review');

        await review.getByRole('button', { name: 'Start import' }).click();
        await expect(page.getByRole('progressbar', { name: 'Import progress' })).toBeVisible();
        await expect(page.getByRole('list', { name: 'projects in this import' })).toBeVisible();
        await noViolations(page, 'Progress');

        await expect(page.getByText('All 8 projects imported.')).toBeVisible(FINISH);
        await expect(page.getByRole('status').filter({ hasText: 'All 8' })).toContainText(
          /issues.*are in Work\./,
        );
        const projects = page.getByRole('list', { name: 'Projects' });
        await expect(projects.getByRole('listitem')).toHaveCount(5);
        await expect(page.getByRole('button', { name: 'Run again' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Download the list (CSV)' })).toBeVisible();
        await noViolations(page, 'Done');
      });

      test('the chooser by keyboard', async ({ page }) => {
        await openImport(page, mode);
        await connect(page);
        await chooserReady(page, 9);
        const search = page.getByRole('searchbox', { name: 'Search projects' });
        const list = chooserList(page);

        // Down from search moves into the list, on its first row.
        await search.focus();
        await page.keyboard.press('ArrowDown');
        await expect(list).toBeFocused();
        await unticked(page, 'Platform');
        await page.keyboard.press('Space');
        await ticked(page, 'Platform');
        await expect(continueWith(page, 10)).toBeVisible();

        // Shift+Down extends the range from the anchor: Support desk, then Mobile apps.
        await option(page, 'Mobile apps').click();
        await unticked(page, 'Mobile apps');
        await page.keyboard.press('Home');
        await page.keyboard.press('Shift+ArrowDown');
        await page.keyboard.press('Shift+ArrowDown');
        await ticked(page, 'Mobile apps');

        // Mod+A ticks everything shown that can be read.
        await page.keyboard.press('ControlOrMeta+a');
        await expect(continueWith(page, 12)).toBeVisible();
        await expect(page.getByRole('checkbox', { name: 'Select all shown' })).toBeChecked();

        // Clear, then Undo in the toast puts every tick back.
        await page.getByRole('button', { name: 'Clear', exact: true }).click();
        await expect(continueWith(page, 0)).toBeVisible();
        await expect(page.getByText('Cleared 12 projects')).toBeVisible();
        await noViolations(page, 'Choose with the Undo toast');
        await page.getByRole('button', { name: 'Undo' }).click();
        await expect(continueWith(page, 12)).toBeVisible();
        await ticked(page, 'Mobile apps');

        // Search narrows; Escape clears it; nothing matching says so.
        await search.fill('data');
        await expect(page.getByRole('option')).toHaveCount(1);
        await search.press('Escape');
        await expect(search).toHaveValue('');
        await expect(option(page, 'Platform')).toBeVisible();
        await expect(option(page, 'Data pipeline')).toBeVisible();
        await search.fill('zzz');
        await expect(page.getByText('No projects match “zzz”')).toBeVisible();
        await noViolations(page, 'Choose, no match');
        await page.getByRole('button', { name: 'Clear search' }).click();
        await expect(search).toHaveValue('');
      });

      test('a site with 1,240 projects searches on the server and counts as it scrolls', async ({
        page,
      }) => {
        await openImport(page, mode);
        await connect(page, { site: 'https://big.example.net' });
        await expect(chooserList(page)).toBeVisible();
        await expect(page.getByText(/1,240 projects\./)).toBeVisible();
        await expect(continueWith(page, 0)).toBeVisible();
        // Rows in view are counted on request; the counting marks then go.
        await expect.poll(() => countingInView(page), FINISH).toBe(0);
        await noViolations(page, 'Choose 1,240 projects');

        const counted = page.waitForRequest(
          (request) => request.method() === 'POST' && request.url().includes('/containers/counts'),
        );
        await chooserList(page).hover();
        await page.mouse.wheel(0, 6000);
        await counted;
        // Rows drawn above the view (the list's overscan) are counted when they come into it.
        await expect.poll(() => countingInView(page), FINISH).toBe(0);

        const searched = page.waitForRequest(
          (request) =>
            request.url().includes('/containers?') &&
            new URL(request.url()).searchParams.get('q') === 'atlas billing',
        );
        await page.getByRole('searchbox', { name: 'Search projects' }).fill('atlas billing');
        await searched;
        await expect(page.getByRole('option').first()).toContainText('Atlas billing');
        const shown = await page.getByRole('option').count();
        expect(shown).toBeGreaterThan(0);
        expect(shown).toBeLessThan(20);
      });

      test('a project that fails partway is retried on its own', async ({ page }) => {
        await openImport(page, mode);
        await start(page, { site: 'https://flaky.example.net' });
        await expect(page.getByText('8 of 9 projects imported.')).toBeVisible(FINISH);
        await expect(page.getByText(/Mobile apps stopped partway/)).toBeVisible();
        const first = page.getByRole('list', { name: 'Projects' }).getByRole('listitem').first();
        await expect(first).toContainText('Mobile apps');
        await expect(first).toContainText('Jira kept answering "too many requests"');
        await noViolations(page, 'Done, partial failure');
        const retried = page.waitForRequest(
          (request) => request.method() === 'POST' && request.url().endsWith('/run'),
        );
        await first.getByRole('button', { name: 'Retry Mobile apps' }).click();
        expect((await retried).postDataJSON()).toEqual({ containers: ['10003'] });
        await expect(page.getByText('All 9 projects imported.')).toBeVisible(FINISH);
      });

      test('Confluence lists spaces and pages', async ({ page }) => {
        await openImport(page, mode);
        await connect(page, { source: 'Confluence', site: 'https://acme.example.net/wiki' });
        await expect(page.getByRole('region', { name: /Choose spaces/ })).toBeVisible();
        await expect(chooserList(page)).toBeVisible();
        await unticked(page, '~rohan');
        await ticked(page, 'Product');
        await expect(page.getByText(/Legal can't be read with this token/)).toBeVisible();
        await noViolations(page, 'Confluence choose');
        await page.getByRole('button', { name: /^Continue with \d+/ }).click();
        await expect(page.getByRole('region', { name: /What to bring/ })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Review import' })).toBeVisible();
        await noViolations(page, 'Confluence options');
      });

      test('a refused token is marked beside the form', async ({ page }) => {
        await openImport(page, mode);
        await connect(page, { token: 'wrong' });
        await expect(page.getByRole('alert')).toContainText('Jira refused the credentials');
        await expect(page.getByLabel('API token')).toHaveAttribute('aria-invalid', 'true');
        await expect(page.getByLabel('Account email')).toHaveValue('rohan@acmelabs.dev');
        await noViolations(page, 'Connect, wrong token');
      });

      test('a token that sees nothing says so, with a way back', async ({ page }) => {
        await openImport(page, mode);
        await connect(page, { site: 'https://empty.example.net' });
        await expect(
          page.getByRole('heading', { name: "This token can't see any projects" }),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Check again' })).toBeVisible();
        await noViolations(page, 'Choose, empty');
        await page.getByRole('button', { name: 'Change connection' }).click();
        await expect(page.getByLabel('Site address')).toBeVisible();
      });

      test('the setup wizard connects, chooses and runs in the background', async ({ page }) => {
        await openImport(page, mode, '/setup?step=3', 'wizard');
        await expect(
          page.getByRole('heading', { level: 1, name: 'Bring your data, or start clean' }),
        ).toBeVisible();
        await connect(page);
        const begin = page.getByRole('button', { name: 'Start import of 9' });
        await expect(begin).toBeVisible();
        await expect(page.getByRole('navigation', { name: 'Import steps' })).toHaveCount(0);
        await noViolations(page, 'wizard Choose');
        await begin.click();
        await expect(page.getByText('Importing 9 projects from Jira.')).toBeVisible();
        await expect(page.getByText(/keeps running while you finish setup/)).toBeVisible();
        await expect(page.getByRole('progressbar', { name: 'Import progress' })).toBeVisible();
        await expect(page.getByRole('region', { name: /What to bring/ })).toHaveCount(0);
        await noViolations(page, 'wizard running');
        await page.getByRole('button', { name: 'Continue' }).click();
        await expect(
          page.getByRole('heading', { level: 1, name: 'Invite your team' }),
        ).toBeVisible();
      });
    });
  }
}

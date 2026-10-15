import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { IMPORT_SHOTS } from './import-shots.config.ts';
import type { MockBackend } from './support/mock-backend.ts';
import {
  chooserReady,
  connect,
  fillConnect,
  FINISH,
  fixSup,
  holdRun,
  type Mode,
  openImport,
  start,
  toOptions,
  toReview,
  VIEWPORTS,
} from './support/import-flow.ts';

/*
 * Screenshots of every importer step and state, at 1440 and 390, light and dark, for review.
 * They are written outside the repository, so they run only when asked:
 *   BEMMOLY_IMPORT_SHOTS=1 pnpm exec playwright test --project=chromium e2e/import-shots.spec.ts
 * Without the variable this file registers no tests.
 */
const OUT = join(homedir(), '.cache', 'bemmoly-import-shots');

type Step = (page: Page, backend: MockBackend) => Promise<unknown>;

const WIZARD = '/setup?step=3';

/** The overall bar has moved off zero (the hold keeps it there after). */
const underWay = (page: Page) =>
  expect
    .poll(
      async () =>
        Number(
          await page
            .getByRole('progressbar', { name: 'Import progress' })
            .getAttribute('aria-valuenow'),
        ),
      FINISH,
    )
    .toBeGreaterThan(0);

/**
 * The shell scrolls inside its main column, not the window, so a full-page picture needs a
 * viewport as tall as the tallest scroller's content.
 */
async function fitHeight(page: Page, width: number) {
  const height = await page.evaluate(() => {
    // The page's own scroller: the one with most hidden below, leaving out the chooser's
    // list (a window onto 1,240 rows) and the sidebar.
    let extra = 0;
    for (const element of document.querySelectorAll<HTMLElement>('body *')) {
      if (element.closest('[role="listbox"], aside, nav')) continue;
      const overflow = getComputedStyle(element).overflowY;
      if (overflow !== 'auto' && overflow !== 'scroll') continue;
      extra = Math.max(extra, element.scrollHeight - element.clientHeight);
    }
    return Math.max(document.documentElement.scrollHeight, window.innerHeight + extra);
  });
  await page.setViewportSize({ width, height: Math.min(height, 6000) });
}

const STEPS: Record<string, { step: Step; path?: string }> = {
  connect: { step: (page) => fillConnect(page) },
  'connect-wrong-token': {
    step: async (page) => {
      await connect(page, { token: 'wrong' });
      await expect(page.getByRole('alert')).toContainText('refused the credentials');
    },
  },
  choose: {
    step: async (page) => {
      await connect(page);
      await chooserReady(page, 9);
      await expect(page.getByText(/can't be read with this token/)).toBeVisible();
    },
  },
  'choose-1240': {
    step: async (page) => {
      await connect(page, { site: 'https://big.example.net' });
      await chooserReady(page, 0);
      await expect(page.getByRole('img', { name: 'Counting' })).toHaveCount(0, FINISH);
    },
  },
  'choose-empty': {
    step: async (page) => {
      await connect(page, { site: 'https://empty.example.net' });
      await expect(page.getByRole('button', { name: 'Check again' })).toBeVisible();
    },
  },
  'choose-no-match': {
    step: async (page) => {
      await connect(page);
      await chooserReady(page, 9);
      await page.getByRole('searchbox', { name: 'Search projects' }).fill('zzz');
      await expect(page.getByText('No projects match “zzz”')).toBeVisible();
    },
  },
  'choose-undo': {
    step: async (page) => {
      await connect(page);
      await chooserReady(page, 9);
      await page.getByRole('button', { name: 'Clear', exact: true }).click();
      await expect(page.getByText('Cleared 9 projects')).toBeVisible();
    },
  },
  'confluence-choose': {
    step: async (page) => {
      await connect(page, { source: 'Confluence', site: 'https://acme.example.net/wiki' });
      await expect(page.getByRole('region', { name: /Choose spaces/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Continue with \d+/ })).toBeVisible();
    },
  },
  'options-clash': { step: (page) => toOptions(page) },
  'options-fixed': {
    step: async (page) => {
      await toOptions(page);
      await fixSup(page);
    },
  },
  'options-confluence': {
    step: async (page) => {
      await connect(page, { source: 'Confluence', site: 'https://acme.example.net/wiki' });
      await page.getByRole('button', { name: /^Continue with \d+/ }).click();
      await expect(page.getByRole('region', { name: /What to bring/ })).toBeVisible();
      await expect(page.getByRole('region', { name: /People/ })).toBeVisible();
    },
  },
  review: { step: (page) => toReview(page) },
  progress: {
    step: async (page, backend) => {
      await holdRun(page, backend);
      await start(page);
      await expect(page.getByText(/of [\d,]+ issues/)).toBeVisible();
      await expect(page.getByRole('list', { name: 'projects in this import' })).toBeVisible();
      await underWay(page);
    },
  },
  'done-all': {
    step: async (page) => {
      await start(page);
      await expect(page.getByText('All 9 projects imported.')).toBeVisible(FINISH);
    },
  },
  'done-partial': {
    step: async (page) => {
      await start(page, { site: 'https://flaky.example.net' });
      await expect(page.getByText('8 of 9 projects imported.')).toBeVisible(FINISH);
    },
  },
  'wizard-choose': {
    path: WIZARD,
    step: async (page) => {
      await connect(page);
      await expect(page.getByRole('button', { name: 'Start import of 9' })).toBeVisible();
    },
  },
  'wizard-running': {
    path: WIZARD,
    step: async (page, backend) => {
      await holdRun(page, backend);
      await connect(page);
      await page.getByRole('button', { name: 'Start import of 9' }).click();
      await expect(page.getByText('Importing 9 projects from Jira.')).toBeVisible();
      await underWay(page);
    },
  },
};

if (IMPORT_SHOTS) {
  mkdirSync(OUT, { recursive: true });
  for (const width of [1440, 390] as const) {
    for (const mode of ['light', 'dark'] as const satisfies readonly Mode[]) {
      test.describe(`import shots · ${width} ${mode}`, () => {
        test.use({ viewport: VIEWPORTS[width] });
        for (const [name, { step, path }] of Object.entries(STEPS)) {
          test(name, async ({ page }) => {
            const backend = await openImport(
              page,
              mode,
              path ?? '/settings/import',
              path ? 'wizard' : 'ready',
            );
            await step(page, backend);
            // Fonts and entrances settle before the picture.
            await page.evaluate(() => document.fonts.ready);
            await page.waitForTimeout(300);
            await fitHeight(page, width);
            await page.waitForTimeout(300);
            await page.screenshot({
              path: join(OUT, `${name}-${width}-${mode}.png`),
              fullPage: true,
            });
          });
        }
      });
    }
  }
}

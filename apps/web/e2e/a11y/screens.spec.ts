import { appendFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { THEME_IDS } from '@bemmoly/ui/tokens';
// Not a React hook: renamed so the hooks lint does not read it as one.
import { useMockBackend as mockBackend } from '../support/mock-backend.ts';
import { A11Y_REPORT, A11Y_THEME } from './a11y.config.ts';
import { audit, describe, type Finding } from './axe.ts';
import { closeCollab, DOCS, PRODUCT, SETTINGS, SIGNED_OUT, WORK, type Screen } from './screens.ts';

/*
 * The WCAG 2.2 AA audit (docs/accessibility-conformance.md): every screen through axe with
 * every rule on, colour contrast included, in each of the five themes, light and dark, at
 * desktop width and at 390px. One test per group, theme, mode and width, so a failure names
 * all four. A11Y_REPORT=<file> records findings as JSON lines instead of failing, for audits.
 */
const GROUPS = {
  'signed out': SIGNED_OUT,
  product: PRODUCT,
  work: WORK,
  docs: DOCS,
  settings: SETTINGS,
};
const WIDTHS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const REPORT = A11Y_REPORT;
/** CI runs one theme per runner; locally every theme runs. */
const THEMES = A11Y_THEME ? [A11Y_THEME] : THEME_IDS;

/** Opens a screen on its own mock backend in a theme and mode, then audits it. */
async function check(page: Page, screen: Screen, theme: string, mode: 'light' | 'dark') {
  const backend = await mockBackend(page, screen.scenario ?? 'ready');
  backend.api.db.settings['appearance.theme'] = theme;
  backend.api.db.settings['appearance.defaultMode'] = mode;
  await page.goto(screen.path);
  await screen.ready?.(page);
  await screen.open?.(page);
  await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
  // Entrances settle before axe reads colours: reduced motion makes them instant.
  await page.waitForTimeout(300);
  return audit(page);
}

for (const [group, screens] of Object.entries(GROUPS)) {
  for (const theme of THEMES) {
    for (const mode of ['light', 'dark'] as const) {
      for (const [width, viewport] of Object.entries(WIDTHS)) {
        test(`${group} · ${theme} ${mode} · ${width}`, async ({ browser }) => {
          test.setTimeout(30_000 + screens.length * 15_000);
          const failures: string[] = [];
          for (const screen of screens) {
            const context = await browser.newContext({
              viewport,
              reducedMotion: 'reduce',
              // Screens before a workspace exists follow the device, so the device asks too.
              colorScheme: mode,
            });
            const page = await context.newPage();
            await closeCollab(page);
            let findings: Finding[] = [];
            let error: string | undefined;
            try {
              findings = await check(page, screen, theme, mode);
            } catch (thrown) {
              error = String(thrown).split('\n')[0];
              failures.push(`${screen.name}: did not load (${error})`);
            } finally {
              await context.close();
            }
            if (REPORT) {
              const row = { group, theme, mode, width, screen: screen.name, error, findings };
              appendFileSync(REPORT, `${JSON.stringify(row)}\n`);
            }
            failures.push(...describe(findings).map((line) => `${screen.name} › ${line}`));
          }
          if (!REPORT) expect(failures, 'accessibility violations').toEqual([]);
        });
      }
    }
  }
}

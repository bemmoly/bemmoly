import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env['CI']);

/**
 * The Work and Docs flows against a real install: Postgres, the server from this
 * checkout and the built web app (`pnpm build` first). The global setup
 * starts all three and seeds the people; nothing is mocked.
 *
 * Three projects run one after the other. The flows share the server and run
 * in parallel, each in its own project key. Enabling and disabling Work
 * changes the whole install, so it runs alone after them, and the board
 * budget runs last on a quiet server so its numbers are its own.
 */
export default defineConfig({
  testDir: 'flows',
  /** A fixed server port (BEMMOLY_E2E_PORT) for machines that must keep to a range; else a free one. */
  metadata: {
    serverPort: Number(process.env['BEMMOLY_E2E_PORT'] ?? 0),
    /** The modules the install enables, comma separated; empty means work,docs. */
    modules: process.env['BEMMOLY_E2E_MODULES'] ?? '',
  },
  globalSetup: './support/global-setup.ts',
  fullyParallel: true,
  forbidOnly: CI,
  retries: 0,
  workers: CI ? 2 : 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: CI ? [['github'], ['list']] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'flows', testIgnore: ['modules.spec.ts', 'board-budget.spec.ts'] },
    { name: 'modules', testMatch: 'modules.spec.ts', dependencies: ['flows'] },
    { name: 'budget', testMatch: 'board-budget.spec.ts', dependencies: ['modules'] },
  ],
});

import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env['CI']);

/**
 * The Work flows against a real install: Postgres, the server from this
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

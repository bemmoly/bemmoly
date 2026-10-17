import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env['CI']);

/**
 * Bemmoly Pipelines' morning walkthrough against a real install: Postgres, the server from
 * this checkout serving the built web apps (`pnpm build` first), Acme seeded, and a local
 * runner that really runs the demo pipeline's steps. docs/pipelines/try-it.md is the same
 * walkthrough by hand. The journeys change shared state (runs, releases, promotions), so
 * they run one at a time, in file order.
 */
export default defineConfig({
  testDir: 'pipelines',
  metadata: {
    serverPort: Number(process.env['BEMMOLY_E2E_PORT'] ?? 0),
    /** The share of the full Acme seed (1,140 applications) to load; small keeps setup quick. */
    seedScale: Number(process.env['BEMMOLY_E2E_SEED_SCALE'] ?? 0.1),
  },
  globalSetup: './support/pipelines-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: CI ? [['github'], ['list']] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'pipelines' }],
});

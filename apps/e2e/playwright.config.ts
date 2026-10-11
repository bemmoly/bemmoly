import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env['CI']);

/**
 * The Work and Docs flows against a real install: Postgres, the server from this
 * checkout and the built web app (`pnpm build` first). The global setup
 * starts all three and seeds the people; nothing is mocked.
 *
 * Seven projects run one after the other. The flows share the server and run
 * in parallel, each in its own project key. Enabling and disabling Work
 * changes the whole install, so it runs alone after them, the board budget
 * runs on a quiet server so its numbers are its own, and Settings › AI,
 * which turns AI on and off for everyone, runs last.
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
    {
      name: 'flows',
      testIgnore: [
        'modules.spec.ts',
        'board-budget.spec.ts',
        'ai-settings.spec.ts',
        'editor-ai.spec.ts',
        'auth-policy.spec.ts',
        'break-glass.spec.ts',
      ],
    },
    { name: 'modules', testMatch: 'modules.spec.ts', dependencies: ['flows'] },
    { name: 'budget', testMatch: 'board-budget.spec.ts', dependencies: ['modules'] },
    // Turning AI on and off changes every screen, so Settings › AI runs alone, at the end.
    { name: 'ai-settings', testMatch: 'ai-settings.spec.ts', dependencies: ['budget'] },
    // The editor's AI turns it on and off again too, so it runs alone after that.
    { name: 'editor-ai', testMatch: 'editor-ai.spec.ts', dependencies: ['ai-settings'] },
    // Single sign-on required and an unfinished setup change every sign-in page, so last.
    { name: 'auth-policy', testMatch: 'auth-policy.spec.ts', dependencies: ['editor-ai'] },
    // Break-glass admins require single sign-on for a while too, so after the sign-in policy.
    { name: 'break-glass', testMatch: 'break-glass.spec.ts', dependencies: ['auth-policy'] },
  ],
});
